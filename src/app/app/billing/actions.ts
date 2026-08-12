"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  charges,
  payments,
  paymentPromises,
  type ChargeType,
  type PaymentMethod,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { fromCents, parseAmount, weeklyCents } from "@/lib/billing";
import { canAcceptPayment } from "@/lib/fee-schedule";
import { addDaysIso, todayIso, weekStartIso } from "@/lib/schedule";

const CHARGE_TYPES: ChargeType[] = [
  "rent",
  "deposit",
  "admission_fee",
  "late_fee",
  "damage",
  "other",
];

const METHODS: PaymentMethod[] = [
  "cash",
  "check",
  "money_order",
  "card",
  "ach",
  "other",
];

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function refresh(residentId?: string) {
  revalidatePath("/app/billing");
  revalidatePath("/app/today");
  revalidatePath("/me");
  if (residentId) revalidatePath(`/app/residents/${residentId}`);
}

/** Confirms the resident is in this org and in a house the user can manage. */
async function scopedResident(residentId: string, access: Access) {
  const [row] = await db
    .select({ id: residents.id, houseId: beds.houseId })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .where(and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)))
    .limit(1);
  if (!row) return null;
  if (access.isAdmin) return row;
  if (row.houseId && (access.houseIds ?? []).includes(row.houseId)) return row;
  return null;
}

/**
 * Bills a week of rent for everyone currently in a house. Safe to run twice —
 * the unique index on (resident, type, period) means a second run adds nothing.
 */
export async function generateWeeklyRent(formData: FormData) {
  const access = await getAccess();
  const houseId = field(formData, "houseId");
  if (!houseId) return;
  if (!access.isAdmin && !(access.houseIds ?? []).includes(houseId)) return;

  const [house] = await db
    .select({ id: houses.id })
    .from(houses)
    .where(and(eq(houses.id, houseId), eq(houses.orgId, access.orgId)))
    .limit(1);
  if (!house) return;

  const weekStart = field(formData, "weekStart") || weekStartIso(todayIso());
  const weekEnd = addDaysIso(weekStart, 6);

  const roster = await db
    .select({
      id: residents.id,
      rate: beds.monthlyRate,
      period: beds.ratePeriod,
    })
    .from(residents)
    .innerJoin(beds, eq(residents.bedId, beds.id))
    .where(
      and(
        eq(residents.orgId, access.orgId),
        eq(residents.status, "active"),
        eq(beds.houseId, houseId),
      ),
    );

  const rows = roster
    .map((r) => ({ id: r.id, cents: weeklyCents(r.rate, r.period) }))
    .filter((r): r is { id: string; cents: number } => !!r.cents)
    .map((r) => ({
      orgId: access.orgId,
      residentId: r.id,
      type: "rent" as const,
      amount: fromCents(r.cents),
      // Rent is due before the week is stayed, so it falls due on day one.
      dueDate: weekStart,
      periodStart: weekStart,
      periodEnd: weekEnd,
      createdBy: access.profile.id,
    }));

  if (!rows.length) return;

  await db.insert(charges).values(rows).onConflictDoNothing();
  refresh();
}

export async function addCharge(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId || !(await scopedResident(residentId, access))) return;

  const cents = parseAmount(field(formData, "amount"));
  if (!cents) return;

  const type = field(formData, "type") as ChargeType;
  if (!CHARGE_TYPES.includes(type)) return;

  await db.insert(charges).values({
    orgId: access.orgId,
    residentId,
    type,
    amount: fromCents(cents),
    description: field(formData, "description") || null,
    dueDate: field(formData, "dueDate") || todayIso(),
    createdBy: access.profile.id,
  });

  refresh(residentId);
}

export async function recordPayment(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId || !(await scopedResident(residentId, access))) return;

  // Standard 3a: no money before the fee schedule is signed.
  if (!(await canAcceptPayment(residentId, access.orgId))) return;

  const cents = parseAmount(field(formData, "amount"));
  if (!cents) return;

  const method = field(formData, "method") as PaymentMethod;

  await db.insert(payments).values({
    orgId: access.orgId,
    residentId,
    amount: fromCents(cents),
    receivedOn: field(formData, "receivedOn") || todayIso(),
    method: METHODS.includes(method) ? method : "cash",
    payerName: field(formData, "payerName") || null,
    reference: field(formData, "reference") || null,
    recordedBy: access.profile.id,
  });

  refresh(residentId);
}

/** Forgives a charge without deleting it, so the decision stays on the record. */
export async function waiveCharge(formData: FormData) {
  const access = await getAccess();
  const chargeId = field(formData, "chargeId");
  if (!chargeId) return;

  const [row] = await db
    .select({ residentId: charges.residentId })
    .from(charges)
    .where(and(eq(charges.id, chargeId), eq(charges.orgId, access.orgId)))
    .limit(1);
  if (!row || !(await scopedResident(row.residentId, access))) return;

  await db
    .update(charges)
    .set({
      waivedAt: new Date(),
      waivedBy: access.profile.id,
      waivedReason: field(formData, "reason") || null,
    })
    .where(eq(charges.id, chargeId));

  refresh(row.residentId);
}

export async function grantPromise(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId || !(await scopedResident(residentId, access))) return;

  const cents = parseAmount(field(formData, "amount"));
  const dueBy = field(formData, "dueBy");
  if (!cents || !dueBy) return;

  await db.insert(paymentPromises).values({
    orgId: access.orgId,
    residentId,
    amount: fromCents(cents),
    dueBy,
    reason: field(formData, "reason") || null,
    grantedBy: access.profile.id,
  });

  refresh(residentId);
}

export async function closePromise(formData: FormData) {
  const access = await getAccess();
  const promiseId = field(formData, "promiseId");
  if (!promiseId) return;

  const [row] = await db
    .select({ residentId: paymentPromises.residentId })
    .from(paymentPromises)
    .where(
      and(
        eq(paymentPromises.id, promiseId),
        eq(paymentPromises.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!row || !(await scopedResident(row.residentId, access))) return;

  await db
    .update(paymentPromises)
    .set({ closedAt: new Date() })
    .where(eq(paymentPromises.id, promiseId));

  refresh(row.residentId);
}

/** Deletes a charge entered by mistake. Only allowed while nothing is waived. */
export async function deleteCharge(formData: FormData) {
  const access = await getAccess();
  const chargeId = field(formData, "chargeId");
  if (!chargeId) return;

  const [row] = await db
    .select({ residentId: charges.residentId })
    .from(charges)
    .where(and(eq(charges.id, chargeId), eq(charges.orgId, access.orgId)))
    .limit(1);
  if (!row || !(await scopedResident(row.residentId, access))) return;

  await db.delete(charges).where(eq(charges.id, chargeId));
  refresh(row.residentId);
}
