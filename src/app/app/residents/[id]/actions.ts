"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { residents, beds, houses, residentLogs } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";

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

/** True when the resident exists and belongs to the current org. */
async function residentInOrg(residentId: string, orgId: string) {
  const [row] = await db
    .select({ id: residents.id, bedId: residents.bedId })
    .from(residents)
    .where(and(eq(residents.id, residentId), eq(residents.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

function refresh(residentId: string) {
  revalidatePath(`/app/residents/${residentId}`);
  revalidatePath("/app/residents");
  revalidatePath("/app/property");
  revalidatePath("/app");
}

export async function addLog(formData: FormData) {
  const profile = await getCurrentProfile();
  const residentId = field(formData, "residentId");
  const type = field(formData, "type") as LogType;
  if (!residentId || !LOG_TYPES.includes(type)) return;
  if (!(await residentInOrg(residentId, profile.orgId!))) return;

  const rawResult = field(formData, "result") as Result;
  const result =
    type === "drug_test" && RESULTS.includes(rawResult) ? rawResult : null;
  const occurredAt = field(formData, "occurredAt") || today();

  await db.insert(residentLogs).values({
    orgId: profile.orgId!,
    residentId,
    type,
    occurredAt,
    title: field(formData, "title") || null,
    detail: field(formData, "detail") || null,
    result,
    createdBy: profile.id,
  });

  refresh(residentId);
}

export async function deleteLog(formData: FormData) {
  const profile = await getCurrentProfile();
  const logId = field(formData, "logId");
  const residentId = field(formData, "residentId");
  if (!logId) return;

  await db
    .delete(residentLogs)
    .where(
      and(
        eq(residentLogs.id, logId),
        eq(residentLogs.orgId, profile.orgId!),
      ),
    );

  if (residentId) refresh(residentId);
}

/** Assign or move a resident to a bed, freeing any previous bed. */
export async function assignBed(formData: FormData) {
  const profile = await getCurrentProfile();
  const residentId = field(formData, "residentId");
  const bedId = field(formData, "bedId");
  if (!residentId || !bedId) return;

  const resident = await residentInOrg(residentId, profile.orgId!);
  if (!resident) return;

  // The target bed must belong to the org and be free.
  const [bed] = await db
    .select({ id: beds.id, status: beds.status })
    .from(beds)
    .innerJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(beds.id, bedId), eq(houses.orgId, profile.orgId!)))
    .limit(1);
  if (!bed) return;
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
  const profile = await getCurrentProfile();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const resident = await residentInOrg(residentId, profile.orgId!);
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
