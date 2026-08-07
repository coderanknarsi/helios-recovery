import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import {
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  MessagesSquare,
  Siren,
  Sun,
  Wallet,
} from "lucide-react";
import { db } from "@/db";
import {
  residents,
  beds,
  rooms,
  houses,
  residentLogs,
  scheduleItems,
  houseEvents,
  chores,
  choreAssignments,
  charges,
  payments,
  grievances,
  safetyDrills,
  type DrillType,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import { money, toCents } from "@/lib/billing";
import { OPEN_GRIEVANCE_STATUSES } from "@/lib/grievances";
import { overdueDrills } from "@/lib/drills";
import {
  buildAgenda,
  dayOfWeekIso,
  fmtTimeRange,
  todayIso,
  weekStartIso,
  EVENT_TYPE_STYLES,
} from "@/lib/schedule";
import { recordTestRound, quickNote, verifyChores } from "./actions";
import { generateWeeklyRent, recordPayment } from "../billing/actions";

export const metadata: Metadata = { title: "Today" };

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

/** Whole days since a YYYY-MM-DD date. */
function daysSince(iso: string | null, today: string) {
  if (!iso) return null;
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export default async function TodayPage() {
  const access = await getAccess();
  const orgId = access.orgId;
  const today = todayIso();
  const dow = dayOfWeekIso(today);
  const weekStart = weekStartIso(today);

  const myHouses = await db
    .select({ id: houses.id, name: houses.name })
    .from(houses)
    .where(
      access.houseIds
        ? and(eq(houses.orgId, orgId), inArray(houses.id, access.houseIds))
        : eq(houses.orgId, orgId),
    )
    .orderBy(houses.name);

  const houseIds = myHouses.map((h) => h.id);

  if (!houseIds.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
        <h1 className="text-lg font-semibold">Nothing assigned yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Once a house is assigned to you, your day starts here.
        </p>
      </div>
    );
  }

  const [roster, todaysWeekly, todaysEvents, lastTests, weekChores] =
    await Promise.all([
      db
        .select({
          id: residents.id,
          firstName: residents.firstName,
          lastName: residents.lastName,
          houseId: beds.houseId,
          room: rooms.name,
          bed: beds.label,
        })
        .from(residents)
        .innerJoin(beds, eq(residents.bedId, beds.id))
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .where(
          and(
            eq(residents.orgId, orgId),
            eq(residents.status, "active"),
            inArray(beds.houseId, houseIds),
          ),
        )
        .orderBy(residents.firstName, residents.lastName),
      db
        .select()
        .from(scheduleItems)
        .where(
          and(
            eq(scheduleItems.orgId, orgId),
            eq(scheduleItems.active, true),
            eq(scheduleItems.dayOfWeek, dow),
            or(
              isNull(scheduleItems.houseId),
              inArray(scheduleItems.houseId, houseIds),
            ),
          ),
        ),
      db
        .select()
        .from(houseEvents)
        .where(
          and(
            eq(houseEvents.orgId, orgId),
            eq(houseEvents.eventDate, today),
            isNull(houseEvents.cancelledAt),
            or(
              isNull(houseEvents.houseId),
              inArray(houseEvents.houseId, houseIds),
            ),
          ),
        ),
      db
        .select({
          residentId: residentLogs.residentId,
          last: sql<string>`max(${residentLogs.occurredAt})`,
        })
        .from(residentLogs)
        .where(
          and(
            eq(residentLogs.orgId, orgId),
            eq(residentLogs.type, "drug_test"),
          ),
        )
        .groupBy(residentLogs.residentId),
      db
        .select({
          id: choreAssignments.id,
          status: choreAssignments.status,
          choreName: chores.name,
          houseId: chores.houseId,
          residentFirst: residents.firstName,
        })
        .from(choreAssignments)
        .innerJoin(chores, eq(choreAssignments.choreId, chores.id))
        .innerJoin(residents, eq(choreAssignments.residentId, residents.id))
        .where(
          and(
            eq(choreAssignments.orgId, orgId),
            eq(choreAssignments.weekStart, weekStart),
            inArray(chores.houseId, houseIds),
          ),
        ),
    ]);

  const lastTestBy = new Map(lastTests.map((t) => [t.residentId, t.last]));

  const residentIds = roster.map((r) => r.id);
  const [rentCharges, rentPayments] = residentIds.length
    ? await Promise.all([
        db
          .select({
            residentId: charges.residentId,
            amount: charges.amount,
            type: charges.type,
            periodStart: charges.periodStart,
            waivedAt: charges.waivedAt,
          })
          .from(charges)
          .where(
            and(
              eq(charges.orgId, orgId),
              inArray(charges.residentId, residentIds),
            ),
          ),
        db
          .select({
            residentId: payments.residentId,
            amount: payments.amount,
          })
          .from(payments)
          .where(
            and(
              eq(payments.orgId, orgId),
              inArray(payments.residentId, residentIds),
            ),
          ),
      ])
    : [[], []];

  const balanceOf = new Map(
    roster.map((r) => [
      r.id,
      rentCharges
        .filter((c) => c.residentId === r.id && !c.waivedAt)
        .reduce((sum, c) => sum + toCents(c.amount), 0) -
        rentPayments
          .filter((p) => p.residentId === r.id)
          .reduce((sum, p) => sum + toCents(p.amount), 0),
    ]),
  );

  const billedThisWeek = new Set(
    rentCharges
      .filter((c) => c.type === "rent" && c.periodStart === weekStart)
      .map((c) => c.residentId),
  );

  const owing = roster.filter((r) => (balanceOf.get(r.id) ?? 0) > 0);
  const totalOwing = owing.reduce(
    (sum, r) => sum + (balanceOf.get(r.id) ?? 0),
    0,
  );
  const unbilled = roster.filter((r) => !billedThisWeek.has(r.id));

  const agenda = buildAgenda({
    from: today,
    days: 1,
    weekly: todaysWeekly,
    events: todaysEvents,
  });

  const awaitingCheck = weekChores.filter((c) => c.status === "completed");

  const openConcerns = await db
    .select({ id: grievances.id })
    .from(grievances)
    .where(
      and(
        eq(grievances.orgId, access.orgId),
        inArray(grievances.status, OPEN_GRIEVANCE_STATUSES),
        access.isAdmin ? undefined : eq(grievances.adminOnly, false),
        access.isAdmin || !access.houseIds?.length
          ? undefined
          : inArray(grievances.houseId, access.houseIds),
      ),
    );

  const drillRows = houseIds.length
    ? await db
        .select({
          houseId: safetyDrills.houseId,
          type: safetyDrills.type,
          conductedOn: safetyDrills.conductedOn,
        })
        .from(safetyDrills)
        .where(inArray(safetyDrills.houseId, houseIds))
        .orderBy(desc(safetyDrills.conductedOn))
    : [];

  const housesNeedingDrills = houseIds.filter((id) => {
    const lastByType = new Map<DrillType, string>();
    for (const d of drillRows) {
      if (d.houseId === id && !lastByType.has(d.type)) {
        lastByType.set(d.type, d.conductedOn);
      }
    }
    return overdueDrills(lastByType, today).length > 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sun className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Today</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {openConcerns.length > 0 && (
        <Link
          href="/app/grievances"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 transition hover:bg-red-100"
        >
          <MessagesSquare className="h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-700">
              {openConcerns.length} open{" "}
              {openConcerns.length === 1 ? "concern" : "concerns"}
            </p>
            <p className="text-xs text-red-700/80">
              A grievance sitting untouched is the thing an auditor will find.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-red-600" />
        </Link>
      )}

      {housesNeedingDrills.length > 0 && (
        <Link
          href="/app/drills"
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition hover:border-primary"
        >
          <Siren className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {housesNeedingDrills.length === 1
                ? "A house is due a safety drill"
                : `${housesNeedingDrills.length} houses are due a safety drill`}
            </p>
            <p className="text-xs text-muted-foreground">
              Fifteen minutes now, versus explaining the gap at certification.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {roster.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <h2 className="text-base font-semibold">No residents yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Once people are placed in beds, rent, drug tests and chores all run
            from this screen.
          </p>
        </div>
      )}

      {/* Rent — first, because it is due before the week is stayed. */}
      {roster.length > 0 && (
        <section
          className={`rounded-xl border p-6 shadow-sm ${
            owing.length
              ? "border-primary/30 bg-primary/5"
              : "border-border bg-surface"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet
                className={`h-4 w-4 ${owing.length ? "text-primary" : "text-accent"}`}
              />
              <h2 className="text-base font-semibold">
                {owing.length === 0
                  ? "Everyone is paid up"
                  : `${owing.length} owing · ${money(totalOwing)}`}
              </h2>
            </div>
            <Link
              href="/app/billing"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary"
            >
              Rent ledger
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {unbilled.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="text-sm">
                {unbilled.length} resident
                {unbilled.length === 1 ? " has" : "s have"} no rent charged for
                this week.
              </span>
              {myHouses.map((house) => (
                <form key={house.id} action={generateWeeklyRent}>
                  <input type="hidden" name="houseId" value={house.id} />
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    Bill {myHouses.length > 1 ? house.name : "this week"}
                  </button>
                </form>
              ))}
            </div>
          )}

          {owing.length > 0 && (
            <ul className="mt-3 space-y-2">
              {owing.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/app/residents/${r.id}`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                    <span className="text-sm font-semibold text-red-700">
                      {money(balanceOf.get(r.id) ?? 0)}
                    </span>
                  </div>
                  <form
                    action={recordPayment}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="residentId" value={r.id} />
                    <input type="hidden" name="receivedOn" value={today} />
                    <input
                      name="amount"
                      required
                      inputMode="decimal"
                      placeholder="Amount"
                      defaultValue={(
                        (balanceOf.get(r.id) ?? 0) / 100
                      ).toFixed(2)}
                      className={`${fieldClass} h-10 w-28`}
                    />
                    <select name="method" className={`${fieldClass} h-10 w-32`}>
                      <option value="cash">Cash</option>
                      <option value="check">Check</option>
                      <option value="money_order">Money order</option>
                      <option value="card">Card</option>
                      <option value="ach">Bank transfer</option>
                    </select>
                    <input
                      name="payerName"
                      placeholder="Paid by (if not them)"
                      className={`${fieldClass} h-10 w-44`}
                    />
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                    >
                      Take payment
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* What's on */}
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold">What&rsquo;s on today</h2>
        {agenda.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing scheduled.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {agenda.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              >
                <span className="w-24 shrink-0 font-medium tabular-nums">
                  {fmtTimeRange(entry.startTime, entry.endTime)}
                </span>
                <span className="font-medium">{entry.title}</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TYPE_STYLES[entry.type]}`}
                >
                  {entry.location ?? (entry.recurring ? "Weekly" : "One-off")}
                </span>
                {entry.mandatory && (
                  <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Required
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Chores waiting to be checked */}
      {awaitingCheck.length > 0 && (
        <section className="rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {awaitingCheck.length} chore
              {awaitingCheck.length === 1 ? "" : "s"} marked done
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tick the ones you&rsquo;ve looked at.
          </p>
          <form action={verifyChores} className="mt-3 space-y-2">
            {awaitingCheck.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="assignmentId"
                  value={c.id}
                  defaultChecked
                  className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
                />
                <span className="font-medium">{c.choreName}</span>
                <span className="text-muted-foreground">
                  — {c.residentFirst}
                </span>
              </label>
            ))}
            <button
              type="submit"
              className="mt-2 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Mark checked
            </button>
          </form>
        </section>
      )}

      {/* Per-house test round + roster */}
      {myHouses.map((house) => {
        const people = roster.filter((r) => r.houseId === house.id);
        if (!people.length) return null;

        return (
          <section
            key={house.id}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">
                {house.name} &mdash; test round
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Leave anyone you didn&rsquo;t test on &ldquo;not tested&rdquo;.
              Nothing is recorded for them.
            </p>

            <form action={recordTestRound} className="mt-4">
              <input type="hidden" name="houseId" value={house.id} />
              <label className="block text-sm">
                <span className="font-medium">Date</span>
                <input
                  type="date"
                  name="occurredAt"
                  defaultValue={today}
                  className={`${fieldClass} mt-1 max-w-48`}
                />
              </label>

              <ul className="mt-4 divide-y divide-border border-y border-border">
                {people.map((r) => {
                  const since = daysSince(
                    lastTestBy.get(r.id) ?? null,
                    today,
                  );
                  const overdue = since === null || since >= 14;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-40">
                        <Link
                          href={`/app/residents/${r.id}`}
                          className="text-sm font-medium hover:text-primary"
                        >
                          {r.firstName} {r.lastName}
                        </Link>
                        <p
                          className={`text-xs ${overdue ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {since === null
                            ? "Never tested"
                            : since === 0
                              ? "Tested today"
                              : `${since} day${since === 1 ? "" : "s"} since last test`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {[
                          { value: "", label: "Not tested" },
                          { value: "pass", label: "Pass" },
                          { value: "fail", label: "Fail" },
                          { value: "refused", label: "Refused" },
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className="inline-flex items-center gap-1.5"
                          >
                            <input
                              type="radio"
                              name={`result_${r.id}`}
                              value={opt.value}
                              defaultChecked={opt.value === ""}
                              className="h-4 w-4 border-border text-primary focus:ring-ring/40"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <button
                type="submit"
                className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Save test round
              </button>
            </form>

            <details className="mt-5 border-t border-border pt-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                Jot something down
                <ChevronRight className="h-4 w-4" />
              </summary>
              <form action={quickNote} className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium">Who</span>
                    <select name="residentId" required className={`${fieldClass} mt-1`}>
                      <option value="">Choose someone</option>
                      {people.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.firstName} {r.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Kind</span>
                    <select name="type" className={`${fieldClass} mt-1`}>
                      <option value="note">Note</option>
                      <option value="infraction">Rule violation</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-medium">What happened</span>
                  <textarea
                    name="detail"
                    rows={2}
                    required
                    className={`${fieldClass} mt-1`}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
                >
                  Save note
                </button>
              </form>
            </details>
          </section>
        );
      })}
    </div>
  );
}
