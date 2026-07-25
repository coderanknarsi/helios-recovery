import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { profiles, houses, houseAssignments } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { updateMember } from "./actions";

export const metadata: Metadata = { title: "Team" };

const roleOptions = [
  { value: "owner", label: "Owner" },
  { value: "director", label: "Director" },
  { value: "house_manager", label: "House manager" },
  { value: "staff", label: "Staff" },
];

const roleLabels: Record<string, string> = {
  owner: "Owner",
  director: "Director",
  house_manager: "House manager",
  staff: "Staff",
  resident: "Resident",
};

const roleStyles: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  director: "bg-primary/10 text-primary",
  house_manager: "bg-accent/10 text-accent",
  staff: "bg-surface-muted text-muted-foreground",
  resident: "bg-surface-muted text-muted-foreground",
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

function isAdminRole(role: string) {
  return role === "owner" || role === "director";
}

export default async function TeamPage() {
  const access = await requireAdmin();
  const orgId = access.orgId;

  const [members, orgHouses, assignmentRows] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(eq(profiles.orgId, orgId))
      .orderBy(asc(profiles.createdAt)),
    db
      .select()
      .from(houses)
      .where(eq(houses.orgId, orgId))
      .orderBy(asc(houses.name)),
    db
      .select({
        profileId: houseAssignments.profileId,
        houseId: houseAssignments.houseId,
      })
      .from(houseAssignments)
      .where(eq(houseAssignments.orgId, orgId)),
  ]);

  const assignedByProfile = new Map<string, Set<string>>();
  for (const a of assignmentRows) {
    const set = assignedByProfile.get(a.profileId) ?? new Set<string>();
    set.add(a.houseId);
    assignedByProfile.set(a.profileId, set);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set each person&apos;s role and the houses they can manage.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-surface-muted/60 p-4 text-sm text-muted-foreground">
        To add a teammate, create their login in your Supabase dashboard
        (Authentication → Users). After they sign in once they&apos;ll appear
        here, where you can set their role and assign houses. Owners and
        directors can see everything; house managers and staff only see the
        houses you assign to them.
      </div>

      <div className="mt-6 space-y-4">
        {members.map((m) => {
          const assigned = assignedByProfile.get(m.id) ?? new Set<string>();
          const isSelf = m.id === access.profile.id;
          const scoped = !isAdminRole(m.role);
          return (
            <form
              key={m.id}
              action={updateMember}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <input type="hidden" name="profileId" value={m.id} />

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">
                      {m.fullName || m.email || "Unnamed user"}
                    </span>
                    {isSelf && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        You
                      </span>
                    )}
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        roleStyles[m.role] ??
                        "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {roleLabels[m.role] ?? m.role}
                    </span>
                  </div>
                  {m.email && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {m.email}
                    </p>
                  )}
                </div>

                <label className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Role
                  </span>
                  <select
                    name="role"
                    defaultValue={m.role === "resident" ? "staff" : m.role}
                    disabled={isSelf}
                    className={`${fieldClass} w-44 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {roleOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {isSelf && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      You can&apos;t change your own role.
                    </span>
                  )}
                </label>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Assigned houses
                  <span className="ml-1 font-normal">
                    (applies to house managers &amp; staff)
                  </span>
                </p>
                {orgHouses.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No houses yet. Add one under Property first.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {orgHouses.map((h) => (
                      <label
                        key={h.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="houseIds"
                          value={h.id}
                          defaultChecked={assigned.has(h.id)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-ring/40"
                        />
                        {h.name}
                      </label>
                    ))}
                  </div>
                )}
                {!scoped && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {roleLabels[m.role]}s can see every house regardless of
                    assignments.
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                >
                  Save changes
                </button>
              </div>
            </form>
          );
        })}

        {members.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No team members yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
