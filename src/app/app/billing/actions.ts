"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  charges,
  payments,
  paymentDisputes,
  paymentLinks,
  paymentPromises,
  paymentRefunds,
  type ChargeType,
  type PaymentMethod,
  type PaymentRefundReason,
} from "@/db/schema";
import { getAccess, requireAdmin, type Access } from "@/lib/access";
import { fromCents, parseAmount, toCents, weeklyCents } from "@/lib/billing";
import { canAcceptPayment } from "@/lib/fee-schedule";
import { defaultLinkLabel } from "@/lib/payment-links";
import { addDaysIso, todayIso, weekStartIso } from "@/lib/schedule";
import { requireStripe } from "@/lib/stripe";

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

const REFUND_REASONS: PaymentRefundReason[] = [
  "resident_request",
  "duplicate",
  "payment_error",
  "departure_or_policy",
  "other",
];

const refundSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.string().trim().min(1),
  reason: z.enum(REFUND_REASONS),
  note: z.string().trim().min(10).max(1000),
  confirmed: z.literal("on"),
});

export type RefundState = {
  status: "idle" | "success" | "error";
  message?: string;
};

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
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      houseId: beds.houseId,
    })
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

/**
 * Requests a full or partial Stripe refund. The signed refund webhook writes
 * the negative ledger entry; this action only records and submits the request.
 */
export async function requestStripeRefund(
  _previous: RefundState,
  formData: FormData,
): Promise<RefundState> {
  const access = await requireAdmin();
  const parsed = refundSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success || !REFUND_REASONS.includes(parsed.data.reason)) {
    return {
      status: "error",
      message: "Enter a valid amount, reason, note, and confirmation.",
    };
  }

  const cents = parseAmount(parsed.data.amount);
  if (!cents) {
    return { status: "error", message: "Enter a valid refund amount." };
  }

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, parsed.data.paymentId),
        eq(payments.orgId, access.orgId),
        eq(payments.kind, "receipt"),
        eq(payments.method, "card"),
      ),
    )
    .limit(1);
  const paymentIntentId =
    payment?.stripePaymentIntentId ??
    (payment?.reference?.startsWith("pi_") ? payment.reference : null);
  if (!payment || !paymentIntentId) {
    return { status: "error", message: "This card payment is not refundable." };
  }

  const [refunds, openDisputes] = await Promise.all([
    db
      .select({ amount: paymentRefunds.amount })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentId, payment.id),
          inArray(paymentRefunds.status, [
            "requested",
            "pending",
            "requires_action",
            "succeeded",
            "unknown",
          ]),
        ),
      ),
    db
      .select({ id: paymentDisputes.id })
      .from(paymentDisputes)
      .where(
        and(
          eq(paymentDisputes.paymentId, payment.id),
          isNull(paymentDisputes.closedAt),
        ),
      )
      .limit(1),
  ]);
  if (openDisputes.length) {
    return {
      status: "error",
      message: "This payment has an open dispute and cannot be refunded here.",
    };
  }

  const reservedCents = refunds.reduce(
    (sum, refund) => sum + toCents(refund.amount),
    0,
  );
  const remainingCents = toCents(payment.amount) - reservedCents;
  if (cents > remainingCents) {
    return {
      status: "error",
      message: `Only ${fromCents(Math.max(0, remainingCents))} remains refundable.`,
    };
  }

  const requestKey = randomUUID();
  await db.insert(paymentRefunds).values({
    orgId: access.orgId,
    paymentId: payment.id,
    requestKey,
    amount: fromCents(cents),
    reason: parsed.data.reason,
    staffNote: parsed.data.note,
    requestedBy: access.profile.id,
  });

  try {
    const refund = await requireStripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: cents,
        reason:
          parsed.data.reason === "duplicate"
            ? "duplicate"
            : "requested_by_customer",
        metadata: {
          heliosRefundRequestId: requestKey,
          orgId: access.orgId,
          residentId: payment.residentId,
          paymentId: payment.id,
        },
      },
      { idempotencyKey: requestKey },
    );

    await db
      .update(paymentRefunds)
      .set({
        stripeRefundId: refund.id,
        status: refund.status ?? "unknown",
        failureReason: refund.failure_reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.requestKey, requestKey));
  } catch (error) {
    console.error(`[stripe] refund request ${requestKey} needs review`, error);
    await db
      .update(paymentRefunds)
      .set({
        status: "unknown",
        failureReason: "Stripe did not confirm the request. Check the Dashboard.",
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.requestKey, requestKey));
    refresh(payment.residentId);
    return {
      status: "error",
      message:
        "Stripe did not confirm the refund. Check Stripe before trying again.",
    };
  }

  refresh(payment.residentId);
  return {
    status: "success",
    message: "Refund requested. The ledger updates after Stripe confirms it.",
  };
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

/**
 * Mints a card-payment link. Gated on the fee schedule for the same reason
 * recordPayment is: this is the moment money starts moving.
 */
export async function createPaymentLink(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;
  if (!(await canAcceptPayment(residentId, access.orgId))) return;

  const cents = parseAmount(field(formData, "amount"));
  const thirdParty = field(formData, "thirdParty") === "on";
  const label =
    field(formData, "label") ||
    defaultLinkLabel(resident.firstName, resident.lastName, residentId);

  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  await db.insert(paymentLinks).values({
    orgId: access.orgId,
    residentId,
    token: randomBytes(24).toString("base64url"),
    amount: cents ? fromCents(cents) : null,
    label,
    thirdParty,
    expiresAt: expires,
    createdBy: access.profile.id,
  });

  refresh(residentId);
}

export async function revokePaymentLink(formData: FormData) {
  const access = await getAccess();
  const linkId = field(formData, "linkId");
  if (!linkId) return;

  const [row] = await db
    .select({ residentId: paymentLinks.residentId })
    .from(paymentLinks)
    .where(and(eq(paymentLinks.id, linkId), eq(paymentLinks.orgId, access.orgId)))
    .limit(1);
  if (!row || !(await scopedResident(row.residentId, access))) return;

  await db
    .update(paymentLinks)
    .set({ revokedAt: new Date() })
    .where(eq(paymentLinks.id, linkId));

  refresh(row.residentId);
}
