import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getDefaultOrgId } from "@/lib/org";

export type CurrentProfile = {
  id: string;
  orgId: string | null;
  fullName: string | null;
  email: string | null;
  role: string;
};

/** Returns the signed-in Supabase user, or null. */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the current user's profile, creating it on first sign-in.
 * The first person to sign in becomes the org owner; later sign-ins
 * default to staff (until an invite/permissions system exists).
 * Redirects to /login when there is no session.
 */
export async function getCurrentProfile(): Promise<CurrentProfile> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (existing[0]) return existing[0];

  const orgId = await getDefaultOrgId();
  const orgProfiles = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.orgId, orgId));
  const role = orgProfiles.length === 0 ? "owner" : "staff";

  const [created] = await db
    .insert(profiles)
    .values({
      id: user.id,
      orgId,
      email: user.email ?? null,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      role,
    })
    .returning();

  return created;
}
