"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { residents, beds, houses, residentLogs } from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const LOG_TYPES = [
  "note",
  "drug_test",
  "infraction",
  "pass",
  "chore",
  "medication",
] as const;
const RESULTS = ["pass", "fail", "refused", "pending"] as const;

type LogType = (typeof LOG_TYPES)[number];
type Result = (typeof RESULTS)[number];

/**
 * Returns the resident when it belongs to the org AND the current user is
 * allowed to manage it (admins: any; managers: only residents placed in one
 * of their assigned houses).
 */
async function scopedResident(residentId: string, access: Access) {
  const [row] = await db
    .select({
      id: residents.id,
      bedId: residents.bedId,
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

function refresh(residentId: string) {
  revalidatePath(`/app/residents/${residentId}`);
  revalidatePath("/app/residents");
  revalidatePath("/app/property");
  revalidatePath("/app");
}

export async function addLog(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const type = field(formData, "type") as LogType;
  if (!residentId || !LOG_TYPES.includes(type)) return;
  if (!(await scopedResident(residentId, access))) return;

  const rawResult = field(formData, "result") as Result;
  const result =
    type === "drug_test" && RESULTS.includes(rawResult) ? rawResult : null;
  const occurredAt = field(formData, "occurredAt") || today();

  await db.insert(residentLogs).values({
    orgId: access.orgId,
    residentId,
    type,
    occurredAt,
    title: field(formData, "title") || null,
    detail: field(formData, "detail") || null,
    result,
    createdBy: access.profile.id,
  });

  refresh(residentId);
}

export async function deleteLog(formData: FormData) {
  const access = await getAccess();
  const logId = field(formData, "logId");
  const residentId = field(formData, "residentId");
  if (!logId || !residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  await db
    .delete(residentLogs)
    .where(
      and(
        eq(residentLogs.id, logId),
        eq(residentLogs.residentId, residentId),
        eq(residentLogs.orgId, access.orgId),
      ),
    );

  refresh(residentId);
}

/** Assign or move a resident to a bed, freeing any previous bed. */
export async function assignBed(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const bedId = field(formData, "bedId");
  if (!residentId || !bedId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;

  // The target bed must belong to the org (and, for managers, to one of
  // their assigned houses) and be free.
  const [bed] = await db
    .select({ id: beds.id, status: beds.status, houseId: beds.houseId })
    .from(beds)
    .innerJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(beds.id, bedId), eq(houses.orgId, access.orgId)))
    .limit(1);
  if (!bed) return;
  if (
    !access.isAdmin &&
    !(access.houseIds ?? []).includes(bed.houseId)
  )
    return;
  if (bed.status === "occupied" || bed.status === "reserved") return;

  // Free the resident's previous bed, if any.
  if (resident.bedId && resident.bedId !== bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(eq(beds.id, resident.bedId));
  }

  await db.update(beds).set({ status: "occupied" }).where(eq(beds.id, bedId));
  await db
    .update(residents)
    .set({ bedId, updatedAt: new Date() })
    .where(eq(residents.id, residentId));

  refresh(residentId);
}

export async function dischargeResident(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;

  if (resident.bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(eq(beds.id, resident.bedId));
  }

  await db
    .update(residents)
    .set({
      status: "discharged",
      dischargeDate: today(),
      bedId: null,
      updatedAt: new Date(),
    })
    .where(eq(residents.id, residentId));

  refresh(residentId);
}
