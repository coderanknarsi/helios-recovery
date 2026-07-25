import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { houseAssignments } from "@/db/schema";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth";

export type Access = {
  profile: CurrentProfile;
  orgId: string;
  role: string;
  isAdmin: boolean;
  isOwner: boolean;
  /** null = all houses (admins); otherwise the specific houses this user is scoped to. */
  houseIds: string[] | null;
};

/**
 * Resolves the current user's role and house scope.
 * Owners and directors are admins (see everything). House managers and staff
 * are limited to the houses assigned to them.
 */
export async function getAccess(): Promise<Access> {
  const profile = await getCurrentProfile();
  const orgId = profile.orgId!;
  const role = profile.role;
  const isAdmin = role === "owner" || role === "director";

  let houseIds: string[] | null = null;
  if (!isAdmin) {
    const rows = await db
      .select({ houseId: houseAssignments.houseId })
      .from(houseAssignments)
      .where(eq(houseAssignments.profileId, profile.id));
    houseIds = rows.map((r) => r.houseId);
  }

  return {
    profile,
    orgId,
    role,
    isAdmin,
    isOwner: role === "owner",
    houseIds,
  };
}

/** Use in admin-only pages; redirects non-admins back to the overview. */
export async function requireAdmin(): Promise<Access> {
  const access = await getAccess();
  if (!access.isAdmin) redirect("/app");
  return access;
}

/** Returns the org id only when the current user is an admin, else null. */
export async function adminOrgId(): Promise<string | null> {
  const access = await getAccess();
  return access.isAdmin ? access.orgId : null;
}
