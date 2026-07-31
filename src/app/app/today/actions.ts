"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  residentLogs,
  chores,
  choreAssignments,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { todayIso } from "@/lib/schedule";

const RESULTS = ["pass", "fail", "refused"] as const;
type Result = (typeof RESULTS)[number];

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function canTouchHouse(access: Access, houseId: string) {
  if (!access.isAdmin && !(access.houseIds ?? []).includes(houseId)) {
    return false;
  }
  const [row] = await db
    .select({ id: houses.id })
    .from(houses)
    .where(and(eq(houses.id, houseId), eq(houses.orgId, access.orgId)))
    .limit(1);
  return !!row;
}

function refresh() {
  revalidatePath("/app/today");
  revalidatePath("/app/residents");
  revalidatePath("/app");
}

/**
 * Records a whole round of drug tests in one submit. Residents left on "not
 * tested" are skipped rather than stored, so a round is a record of who was
 * actually tested, not a row per person per day.
 */
export async function recordTestRound(formData: FormData) {
  const access = await getAccess();
  const houseId = field(formData, "houseId");
  if (!houseId || !(await canTouchHouse(access, houseId))) return;

  const occurredAt = field(formData, "occurredAt") || todayIso();

  const roster = await db
    .select({ id: residents.id })
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
    .map((r) => ({ id: r.id, result: field(formData, `result_${r.id}`) }))
    .filter((r): r is { id: string; result: Result } =>
      RESULTS.includes(r.result as Result),
    )
    .map((r) => ({
      orgId: access.orgId,
      residentId: r.id,
      type: "drug_test" as const,
      occurredAt,
      result: r.result,
      createdBy: access.profile.id,
    }));

  if (!rows.length) return;

  await db.insert(residentLogs).values(rows);
  for (const row of rows) revalidatePath(`/app/residents/${row.residentId}`);
  refresh();
}

/**
 * A note or incident jotted against one resident without leaving the day view.
 */
export async function quickNote(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const detail = field(formData, "detail");
  if (!residentId || !detail) return;

  const [row] = await db
    .select({ houseId: beds.houseId })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .where(
      and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)),
    )
    .limit(1);
  if (!row) return;
  if (
    !access.isAdmin &&
    !(row.houseId && (access.houseIds ?? []).includes(row.houseId))
  ) {
    return;
  }

  const type = field(formData, "type") === "infraction" ? "infraction" : "note";

  await db.insert(residentLogs).values({
    orgId: access.orgId,
    residentId,
    type,
    occurredAt: todayIso(),
    detail,
    createdBy: access.profile.id,
  });

  revalidatePath(`/app/residents/${residentId}`);
  refresh();
}

/** Marks several chore assignments verified in one go. */
export async function verifyChores(formData: FormData) {
  const access = await getAccess();
  const ids = formData.getAll("assignmentId").filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (!ids.length) return;

  const scoped = await db
    .select({ id: choreAssignments.id, houseId: chores.houseId })
    .from(choreAssignments)
    .innerJoin(chores, eq(choreAssignments.choreId, chores.id))
    .where(
      and(
        eq(choreAssignments.orgId, access.orgId),
        inArray(choreAssignments.id, ids),
      ),
    );

  const allowed = scoped
    .filter(
      (row) =>
        access.isAdmin || (access.houseIds ?? []).includes(row.houseId),
    )
    .map((row) => row.id);
  if (!allowed.length) return;

  await db
    .update(choreAssignments)
    .set({
      status: "verified",
      verifiedBy: access.profile.id,
      verifiedAt: new Date(),
    })
    .where(inArray(choreAssignments.id, allowed));

  revalidatePath("/app/chores");
  refresh();
}
