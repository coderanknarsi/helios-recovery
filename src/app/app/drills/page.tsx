import type { Metadata } from "next";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { ShieldCheck, Siren } from "lucide-react";
import { db } from "@/db";
import {
  beds,
  houses,
  profiles,
  residents,
  safetyDrillAttendees,
  safetyDrills,
  type DrillType,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import {
  DRILL_CADENCE_DAYS,
  DRILL_TYPE_HINTS,
  DRILL_TYPE_LABELS,
  DRILL_TYPE_VALUES,
  daysSince,
  fmtEvacuation,
  overdueDrills,
} from "@/lib/drills";
import { todayIso } from "@/lib/schedule";
import { logDrill } from "./actions";

export const metadata: Metadata = { title: "Safety" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export default async function DrillsPage() {
  const access = await getAccess();
  const today = todayIso();

  const allHouses = await db
    .select({ id: houses.id, name: houses.name })
    .from(houses)
    .where(eq(houses.orgId, access.orgId))
    .orderBy(asc(houses.name));
  const myHouses = access.houseIds
    ? allHouses.filter((h) => access.houseIds!.includes(h.id))
    : allHouses;
  const houseIds = myHouses.map((h) => h.id);

  const [roster, drillRows] = await Promise.all([
    houseIds.length
      ? db
          .select({
            id: residents.id,
            firstName: residents.firstName,
            lastName: residents.lastName,
            houseId: beds.houseId,
          })
          .from(residents)
          .innerJoin(beds, eq(residents.bedId, beds.id))
          .where(
            and(
              eq(residents.orgId, access.orgId),
              eq(residents.status, "active"),
              inArray(beds.houseId, houseIds),
            ),
          )
          .orderBy(asc(residents.firstName))
      : Promise.resolve([]),
    houseIds.length
      ? db
          .select({
            id: safetyDrills.id,
            houseId: safetyDrills.houseId,
            type: safetyDrills.type,
            conductedOn: safetyDrills.conductedOn,
            evacuationSeconds: safetyDrills.evacuationSeconds,
            notes: safetyDrills.notes,
            byName: profiles.fullName,
          })
          .from(safetyDrills)
          .leftJoin(profiles, eq(profiles.id, safetyDrills.conductedBy))
          .where(inArray(safetyDrills.houseId, houseIds))
          .orderBy(desc(safetyDrills.conductedOn))
      : Promise.resolve([]),
  ]);

  const headcounts = drillRows.length
    ? await db
        .select({
          drillId: safetyDrillAttendees.drillId,
          status: safetyDrillAttendees.status,
        })
        .from(safetyDrillAttendees)
        .where(
          inArray(
            safetyDrillAttendees.drillId,
            drillRows.map((d) => d.id),
          ),
        )
    : [];

  const presentCount = new Map<string, number>();
  for (const a of headcounts) {
    if (a.status === "absent") continue;
    presentCount.set(a.drillId, (presentCount.get(a.drillId) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Siren className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Safety</h1>
          <p className="text-sm text-muted-foreground">
            Emergency drills, and proof they happened.
          </p>
        </div>
      </div>

      {myHouses.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm font-medium">No houses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a house under Property and drills can be logged against it.
          </p>
        </div>
      )}

      {myHouses.map((house) => {
        const houseDrills = drillRows.filter((d) => d.houseId === house.id);
        const houseRoster = roster.filter((r) => r.houseId === house.id);

        const lastByType = new Map<DrillType, string>();
        for (const d of houseDrills) {
          if (!lastByType.has(d.type)) lastByType.set(d.type, d.conductedOn);
        }
        const overdue = overdueDrills(lastByType, today);

        return (
          <section
            key={house.id}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{house.name}</h2>
              {overdue.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Up to date
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  {overdue.length} due
                </span>
              )}
            </div>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {DRILL_TYPE_VALUES.filter(
                (t) => DRILL_CADENCE_DAYS[t] !== null,
              ).map((type) => {
                const last = lastByType.get(type);
                const isOverdue = overdue.includes(type);
                return (
                  <li
                    key={type}
                    className={`rounded-lg border p-3 ${
                      isOverdue
                        ? "border-red-200 bg-red-50"
                        : "border-border bg-surface-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">
                      {DRILL_TYPE_LABELS[type]}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        isOverdue ? "text-red-700" : "text-muted-foreground"
                      }`}
                    >
                      {last
                        ? `Last run ${daysSince(last, today)} days ago`
                        : "Never logged"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {DRILL_TYPE_HINTS[type]}
                    </p>
                  </li>
                );
              })}
            </ul>

            {houseRoster.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nobody is placed in this house yet, so there is no roster to
                record.
              </p>
            ) : (
              <details className="mt-4 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                  Log a drill
                </summary>
                <form action={logDrill} className="mt-4 space-y-4">
                  <input type="hidden" name="houseId" value={house.id} />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm sm:col-span-1">
                      <span className="font-medium">Drill</span>
                      <select
                        name="type"
                        required
                        defaultValue="fire_evacuation"
                        className={fieldClass}
                      >
                        {DRILL_TYPE_VALUES.map((t) => (
                          <option key={t} value={t}>
                            {DRILL_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="font-medium">Date</span>
                      <input
                        type="date"
                        name="conductedOn"
                        defaultValue={today}
                        max={today}
                        className={fieldClass}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="font-medium">Seconds to clear</span>
                      <input
                        type="number"
                        name="evacuationSeconds"
                        min={1}
                        placeholder="135"
                        className={fieldClass}
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Who took part</p>
                    {houseRoster.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                      >
                        <span className="text-sm">
                          {r.firstName} {r.lastName}
                        </span>
                        <div className="flex gap-3">
                          {(
                            [
                              ["present", "Took part"],
                              ["absent", "Not here"],
                              ["briefed_later", "Briefed after"],
                            ] as const
                          ).map(([value, label]) => (
                            <label
                              key={value}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              <input
                                type="radio"
                                name={`status_${r.id}`}
                                value={value}
                                defaultChecked={value === "present"}
                                className="h-4 w-4 border-border text-primary focus:ring-ring/40"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="block text-sm">
                    <span className="font-medium">Notes</span>
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Smoke detector in the back bedroom needs a battery."
                      className={fieldClass}
                    />
                  </label>

                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    Log drill
                  </button>
                </form>
              </details>
            )}

            {houseDrills.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {houseDrills.slice(0, 8).map((d) => {
                  const evac = fmtEvacuation(d.evacuationSeconds);
                  return (
                    <li key={d.id} className="text-sm">
                      <span className="font-medium">
                        {DRILL_TYPE_LABELS[d.type]}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        &middot; {d.conductedOn} &middot;{" "}
                        {presentCount.get(d.id) ?? 0} of {houseRoster.length}
                        {evac ? ` · cleared in ${evac}` : ""}
                        {d.byName ? ` · ${d.byName}` : ""}
                      </span>
                      {d.notes && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {d.notes}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
