import { and, asc, eq, inArray } from "drizzle-orm";
import { ClipboardCheck, Plus } from "lucide-react";
import { db } from "@/db";
import {
  beds,
  choreAssignments,
  chores,
  houses,
  residents,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import { addDaysIso, todayIso, weekStartIso } from "@/lib/schedule";
import { assignChore, createChore, toggleChore, verifyChore } from "./actions";

export const dynamic = "force-dynamic";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const statusStyles: Record<string, string> = {
  assigned: "bg-surface-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
  verified: "bg-accent/10 text-accent",
  missed: "bg-red-50 text-red-700",
};

const statusLabels: Record<string, string> = {
  assigned: "Assigned",
  completed: "Marked done",
  verified: "Verified",
  missed: "Missed",
};

export default async function ChoresPage() {
  const access = await getAccess();
  const today = todayIso();
  const weekStart = weekStartIso(today);
  const scoped = access.houseIds;

  const houseRows = await db
    .select({ id: houses.id, name: houses.name })
    .from(houses)
    .where(
      scoped
        ? and(
            eq(houses.orgId, access.orgId),
            inArray(houses.id, scoped.length ? scoped : [""]),
          )
        : eq(houses.orgId, access.orgId),
    )
    .orderBy(asc(houses.name));

  const houseIds = houseRows.map((h) => h.id);

  const [choreRows, assignments, roster] = await Promise.all([
    houseIds.length
      ? db
          .select()
          .from(chores)
          .where(
            and(
              eq(chores.orgId, access.orgId),
              inArray(chores.houseId, houseIds),
            ),
          )
          .orderBy(asc(chores.name))
      : Promise.resolve([]),
    db
      .select({
        id: choreAssignments.id,
        choreId: choreAssignments.choreId,
        residentId: choreAssignments.residentId,
        status: choreAssignments.status,
        completedAt: choreAssignments.completedAt,
      })
      .from(choreAssignments)
      .where(
        and(
          eq(choreAssignments.orgId, access.orgId),
          eq(choreAssignments.weekStart, weekStart),
        ),
      ),
    houseIds.length
      ? db
          .select({
            id: residents.id,
            firstName: residents.firstName,
            lastName: residents.lastName,
            houseId: beds.houseId,
          })
          .from(residents)
          .innerJoin(beds, eq(beds.id, residents.bedId))
          .where(
            and(
              eq(residents.orgId, access.orgId),
              eq(residents.status, "active"),
              inArray(beds.houseId, houseIds),
            ),
          )
          .orderBy(asc(residents.firstName))
      : Promise.resolve([]),
  ]);

  const byChore = new Map(assignments.map((a) => [a.choreId, a]));
  const residentName = new Map(
    roster.map((r) => [r.id, `${r.firstName} ${r.lastName}`]),
  );
  const weekEnd = addDaysIso(weekStart, 6);
  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Chores</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Assign this week&rsquo;s chores, then verify them once they&rsquo;re
          done. Residents see theirs on their Today screen and mark them
          complete themselves.
        </p>
      </div>

      {houseRows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Add a house under Property first.
          </p>
        </div>
      )}

      {houseRows.map((house) => {
        const houseChores = choreRows.filter((c) => c.houseId === house.id);
        const houseRoster = roster.filter((r) => r.houseId === house.id);

        return (
          <section key={house.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{house.name}</h2>
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Week of {weekLabel}
              </span>
            </div>

            {houseChores.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No chores set up for this house yet.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {houseChores.map((chore) => {
                  const assignment = byChore.get(chore.id);
                  return (
                    <li
                      key={chore.id}
                      className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-medium ${chore.active ? "" : "text-muted-foreground line-through"}`}
                        >
                          {chore.name}
                        </span>
                        {assignment && (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[assignment.status]}`}
                          >
                            {statusLabels[assignment.status]}
                          </span>
                        )}
                      </div>
                      {chore.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {chore.description}
                        </p>
                      )}

                      <form
                        action={assignChore}
                        className="mt-3 flex flex-wrap items-end gap-3"
                      >
                        <input
                          type="hidden"
                          name="choreId"
                          value={chore.id}
                        />
                        <input
                          type="hidden"
                          name="weekStart"
                          value={weekStart}
                        />
                        <label className="block text-sm">
                          <span className="font-medium">This week</span>
                          <select
                            name="residentId"
                            defaultValue={assignment?.residentId ?? ""}
                            className={`${fieldClass} min-w-48`}
                          >
                            <option value="">Nobody yet</option>
                            {houseRoster.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.firstName} {r.lastName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                        >
                          Assign
                        </button>
                      </form>

                      {assignment && assignment.status !== "verified" && (
                        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
                          <span className="text-muted-foreground">
                            {residentName.get(assignment.residentId) ??
                              "Resident"}
                            {assignment.completedAt
                              ? " says this is done."
                              : " hasn't marked it done."}
                          </span>
                          <form action={verifyChore}>
                            <input
                              type="hidden"
                              name="id"
                              value={assignment.id}
                            />
                            <input
                              type="hidden"
                              name="outcome"
                              value="verified"
                            />
                            <button
                              type="submit"
                              className="font-medium text-accent transition hover:underline"
                            >
                              Verify
                            </button>
                          </form>
                          <form action={verifyChore}>
                            <input
                              type="hidden"
                              name="id"
                              value={assignment.id}
                            />
                            <input
                              type="hidden"
                              name="outcome"
                              value="missed"
                            />
                            <button
                              type="submit"
                              className="font-medium text-muted-foreground transition hover:text-red-700"
                            >
                              Mark missed
                            </button>
                          </form>
                        </div>
                      )}

                      <form action={toggleChore} className="mt-3">
                        <input type="hidden" name="id" value={chore.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-muted-foreground transition hover:text-primary"
                        >
                          {chore.active ? "Retire this chore" : "Bring it back"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <details className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <summary className="flex cursor-pointer items-center gap-2 text-base font-semibold">
                <Plus className="h-4 w-4 text-primary" />
                Add a chore to {house.name}
              </summary>

              <form action={createChore} className="mt-6 space-y-4">
                <input type="hidden" name="houseId" value={house.id} />
                <label className="block text-sm">
                  <span className="font-medium">Chore</span>
                  <input
                    name="name"
                    required
                    placeholder="Kitchen &amp; dishes"
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">
                    What it involves (optional)
                  </span>
                  <textarea
                    name="description"
                    rows={2}
                    placeholder="Counters wiped, dishes put away, floor swept, bin emptied."
                    className={fieldClass}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Add chore
                </button>
              </form>
            </details>
          </section>
        );
      })}
    </div>
  );
}
