"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { choreAssignments } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";

/**
 * Lets a resident mark their own chore done, or undo it. Deliberately does not
 * set "verified" — staff confirm separately, so the record shows who claimed
 * what and who checked it.
 */
export async function setChoreDone(formData: FormData) {
  const me = await requireResident();
  const id = formData.get("id");
  const done = formData.get("done") === "true";
  if (typeof id !== "string" || !id) return;

  const [assignment] = await db
    .select({ id: choreAssignments.id, status: choreAssignments.status })
    .from(choreAssignments)
    .where(
      and(
        eq(choreAssignments.id, id),
        eq(choreAssignments.residentId, me.residentId),
        eq(choreAssignments.orgId, me.orgId),
      ),
    )
    .limit(1);
  // Once staff have signed it off, the resident can no longer change it.
  if (!assignment || assignment.status === "verified") return;

  await db
    .update(choreAssignments)
    .set({
      status: done ? "completed" : "assigned",
      completedAt: done ? new Date() : null,
    })
    .where(eq(choreAssignments.id, id));

  revalidatePath("/me");
  revalidatePath("/app/chores");
}
