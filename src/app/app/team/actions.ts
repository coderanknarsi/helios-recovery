"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, houses, houseAssignments } from "@/db/schema";
import { getAccess } from "@/lib/access";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const ROLES = ["owner", "director", "house_manager", "staff"] as const;
type Role = (typeof ROLES)[number];

/**
 * Update a team member's role and/or house assignments.
 * Admin-only. You cannot change your own role (prevents self-lockout).
 */
export async function updateMember(formData: FormData) {
  const access = await getAccess();
  if (!access.isAdmin) return;

  const profileId = field(formData, "profileId");
  if (!profileId) return;

  // The target must be in the same org.
  const [target] = await db
    .select({ id: profiles.id, orgId: profiles.orgId })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!target || target.orgId !== access.orgId) return;

  // Role change — never allowed on yourself.
  const role = field(formData, "role") as Role;
  if (profileId !== access.profile.id && ROLES.includes(role)) {
    await db.update(profiles).set({ role }).where(eq(profiles.id, profileId));
  }

  // Replace the member's house assignments with the submitted set.
  const submitted = formData
    .getAll("houseIds")
    .map(String)
    .filter(Boolean);

  const orgHouses = await db
    .select({ id: houses.id })
    .from(houses)
    .where(eq(houses.orgId, access.orgId));
  const valid = new Set(orgHouses.map((h) => h.id));
  const toAssign = [...new Set(submitted.filter((h) => valid.has(h)))];

  await db
    .delete(houseAssignments)
    .where(
      and(
        eq(houseAssignments.profileId, profileId),
        eq(houseAssignments.orgId, access.orgId),
      ),
    );

  if (toAssign.length > 0) {
    await db.insert(houseAssignments).values(
      toAssign.map((houseId) => ({
        orgId: access.orgId,
        profileId,
        houseId,
      })),
    );
  }

  revalidatePath("/app/team");
  revalidatePath("/app");
}
