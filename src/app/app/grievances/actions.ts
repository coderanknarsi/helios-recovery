"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { grievances, grievanceUpdates, type GrievanceStatus } from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";

const STATUSES: GrievanceStatus[] = [
  "submitted",
  "under_review",
  "resolved",
  "escalated",
  "withdrawn",
];

function field(formData: FormData, name: string) {
  const raw = formData.get(name);
  return typeof raw === "string" ? raw.trim() : "";
}

function refresh() {
  revalidatePath("/app/grievances");
  revalidatePath("/app/today");
  revalidatePath("/me/support");
}

/**
 * Re-checks scope server-side on every write. House managers must not be able
 * to reach a grievance that names a staff member, even by guessing an id.
 */
async function scopedGrievance(id: string, access: Access) {
  const [row] = await db
    .select({
      id: grievances.id,
      houseId: grievances.houseId,
      adminOnly: grievances.adminOnly,
    })
    .from(grievances)
    .where(and(eq(grievances.id, id), eq(grievances.orgId, access.orgId)))
    .limit(1);

  if (!row) return null;
  if (access.isAdmin) return row;
  if (row.adminOnly) return null;
  if (!row.houseId) return null;
  if (access.houseIds && !access.houseIds.includes(row.houseId)) return null;
  return row;
}

export async function assignGrievance(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "grievanceId");
  if (!id || !(await scopedGrievance(id, access))) return;

  await db
    .update(grievances)
    .set({ assignedTo: access.profile.id, updatedAt: new Date() })
    .where(eq(grievances.id, id));

  await db.insert(grievanceUpdates).values({
    orgId: access.orgId,
    grievanceId: id,
    note: `Picked up by ${access.profile.fullName ?? "a staff member"}.`,
    authorId: access.profile.id,
  });

  refresh();
}

export async function addGrievanceUpdate(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "grievanceId");
  const note = field(formData, "note");
  const rawStatus = field(formData, "status");
  const visibleToResident = formData.get("visibleToResident") === "on";

  if (!note || !id) return;
  if (!(await scopedGrievance(id, access))) return;

  const status = STATUSES.includes(rawStatus as GrievanceStatus)
    ? (rawStatus as GrievanceStatus)
    : null;

  await db.insert(grievanceUpdates).values({
    orgId: access.orgId,
    grievanceId: id,
    note,
    status,
    visibleToResident,
    authorId: access.profile.id,
  });

  if (status) {
    await db
      .update(grievances)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === "resolved"
          ? {
              resolution: note,
              resolvedAt: new Date(),
              resolvedBy: access.profile.id,
            }
          : {}),
      })
      .where(eq(grievances.id, id));
  }

  refresh();
}
