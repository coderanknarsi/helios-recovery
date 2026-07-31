"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { choreAssignments, chores, residents } from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { notifyResident } from "@/lib/push";
import { addDaysIso, todayIso, weekStartIso } from "@/lib/schedule";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function refresh() {
  revalidatePath("/app/chores");
  revalidatePath("/me");
}

/** True when the current user is allowed to act on this house. */
function canTouchHouse(access: Access, houseId: string) {
  return !access.houseIds || access.houseIds.includes(houseId);
}

/** Loads a chore the current user is allowed to act on, or null. */
async function scopedChore(choreId: string, access: Access) {
  const [chore] = await db
    .select({
      id: chores.id,
      houseId: chores.houseId,
      name: chores.name,
    })
    .from(chores)
    .where(and(eq(chores.id, choreId), eq(chores.orgId, access.orgId)))
    .limit(1);
  if (!chore || !canTouchHouse(access, chore.houseId)) return null;
  return chore;
}

export async function createChore(formData: FormData) {
  const access = await getAccess();
  const name = field(formData, "name");
  const houseId = field(formData, "houseId");
  if (!name || !houseId || !canTouchHouse(access, houseId)) return;

  await db.insert(chores).values({
    orgId: access.orgId,
    houseId,
    name,
    description: field(formData, "description") || null,
    createdBy: access.profile.id,
  });

  refresh();
}

export async function toggleChore(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  if (!id) return;

  const [chore] = await db
    .select({ id: chores.id, houseId: chores.houseId, active: chores.active })
    .from(chores)
    .where(and(eq(chores.id, id), eq(chores.orgId, access.orgId)))
    .limit(1);
  if (!chore || !canTouchHouse(access, chore.houseId)) return;

  await db
    .update(chores)
    .set({ active: !chore.active })
    .where(eq(chores.id, id));

  refresh();
}

/**
 * Assigns a chore for a given week. Re-running for the same chore and week
 * reassigns it rather than creating a duplicate, which is what the unique
 * index on (chore_id, week_start) is for.
 */
export async function assignChore(formData: FormData) {
  const access = await getAccess();
  const choreId = field(formData, "choreId");
  const residentId = field(formData, "residentId");
  const weekStart = field(formData, "weekStart") || weekStartIso(todayIso());
  if (!choreId) return;

  const chore = await scopedChore(choreId, access);
  if (!chore) return;

  // Unassigning is just clearing the resident.
  if (!residentId) {
    await db
      .delete(choreAssignments)
      .where(
        and(
          eq(choreAssignments.choreId, choreId),
          eq(choreAssignments.weekStart, weekStart),
          eq(choreAssignments.orgId, access.orgId),
        ),
      );
    refresh();
    return;
  }

  const [resident] = await db
    .select({ id: residents.id, firstName: residents.firstName })
    .from(residents)
    .where(
      and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)),
    )
    .limit(1);
  if (!resident) return;

  // Chores run Monday to Sunday.
  const dueDate = addDaysIso(weekStart, 6);

  const [row] = await db
    .insert(choreAssignments)
    .values({
      orgId: access.orgId,
      choreId,
      residentId,
      weekStart,
      dueDate,
      createdBy: access.profile.id,
    })
    .onConflictDoUpdate({
      target: [choreAssignments.choreId, choreAssignments.weekStart],
      set: {
        residentId,
        dueDate,
        status: "assigned",
        completedAt: null,
        verifiedBy: null,
        verifiedAt: null,
      },
    })
    .returning({ id: choreAssignments.id });

  if (row) {
    await notifyResident({
      orgId: access.orgId,
      residentId,
      title: "You have a chore this week",
      body: `${chore.name} — due Sunday.`,
      url: "/me",
      sentBy: access.profile.id,
    });
  }

  refresh();
}

export async function verifyChore(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  const outcome = field(formData, "outcome");
  if (!id || (outcome !== "verified" && outcome !== "missed")) return;

  const [assignment] = await db
    .select({ id: choreAssignments.id, choreId: choreAssignments.choreId })
    .from(choreAssignments)
    .where(
      and(
        eq(choreAssignments.id, id),
        eq(choreAssignments.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!assignment) return;
  if (!(await scopedChore(assignment.choreId, access))) return;

  await db
    .update(choreAssignments)
    .set({
      status: outcome,
      verifiedBy: access.profile.id,
      verifiedAt: new Date(),
      note: field(formData, "note") || null,
    })
    .where(eq(choreAssignments.id, id));

  refresh();
}
