import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Wallet, HandCoins, AlertTriangle } from "lucide-react";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  charges,
  payments,
  paymentPromises,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import { residentsWithSignedFeeSchedule } from "@/lib/fee-schedule";
import {
  CHARGE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  money,
  toCents,
  weeklyCents,
} from "@/lib/billing";
import { addDaysIso, fmtDateLabel, todayIso, weekStartIso } from "@/lib/schedule";
import {
  addCharge,
  closePromise,
  deleteCharge,
  generateWeeklyRent,
  grantPromise,
  recordPayment,
  waiveCharge,
} from "./actions";

export const metadata: Metadata = { title: "Rent" };

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export default async function BillingPage() {
  const access = await getAccess();
  const orgId = access.orgId;
  const today = todayIso();
  const weekStart = weekStartIso(today);
  const weekEnd = addDaysIso(weekStart, 6);

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
        <h1 className="text-lg font-semibold">No houses yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a house and set bed rates before billing rent.
        </p>
      </div>
    );
  }

  const roster = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      houseId: beds.houseId,
      rate: beds.monthlyRate,
      period: beds.ratePeriod,
    })
    .from(residents)
    .innerJoin(beds, eq(residents.bedId, beds.id))
    .where(
      and(
        eq(residents.orgId, orgId),
        eq(residents.status, "active"),
        inArray(beds.houseId, houseIds),
      ),
    )
    .orderBy(residents.firstName, residents.lastName);

  const residentIds = roster.map((r) => r.id);

  const [allCharges, allPayments, openPromises] = residentIds.length
    ? await Promise.all([
        db
          .select()
          .from(charges)
          .where(
            and(
              eq(charges.orgId, orgId),
              inArray(charges.residentId, residentIds),
            ),
          )
          .orderBy(desc(charges.dueDate)),
        db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.orgId, orgId),
              inArray(payments.residentId, residentIds),
            ),
          )
          .orderBy(desc(payments.receivedOn)),
        db
          .select()
          .from(paymentPromises)
          .where(
            and(
              eq(paymentPromises.orgId, orgId),
              inArray(paymentPromises.residentId, residentIds),
              isNull(paymentPromises.closedAt),
            ),
          ),
      ])
    : [[], [], []];

  const feeScheduleSigned = await residentsWithSignedFeeSchedule(
    residentIds,
    orgId,
  );
  // Already paying keeps the gate from stranding residents who predate it.
  const canTakeMoney = new Set(
    residentIds.filter(
      (id) =>
        feeScheduleSigned.has(id) ||
        allPayments.some((p) => p.residentId === id),
    ),
  );

  const summary = new Map(
    roster.map((r) => {
      const owed = allCharges
        .filter((c) => c.residentId === r.id && !c.waivedAt)
        .reduce((sum, c) => sum + toCents(c.amount), 0);
      const paid = allPayments
        .filter((p) => p.residentId === r.id)
        .reduce((sum, p) => sum + toCents(p.amount), 0);
      const billedThisWeek = allCharges.some(
        (c) =>
          c.residentId === r.id &&
          c.type === "rent" &&
          c.periodStart === weekStart,
      );
      return [
        r.id,
        {
          owed,
          paid,
          balance: owed - paid,
          billedThisWeek,
          promise: openPromises.find((p) => p.residentId === r.id) ?? null,
        },
      ];
    }),
  );

  const totalOwed = [...summary.values()].reduce(
    (sum, s) => sum + Math.max(0, s.balance),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Wallet className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold">Rent</h1>
          <p className="text-sm text-muted-foreground">
            Week of {fmtDateLabel(weekStart, today)} &ndash;{" "}
            {fmtDateLabel(weekEnd, today)} &middot; {money(totalOwed)}{" "}
            outstanding
          </p>
        </div>
      </div>

      {roster.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <h2 className="text-base font-semibold">Nobody to bill yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rent is worked out from each bed&rsquo;s rate, so residents appear
            here once they&rsquo;re placed in a bed. Set your rates on{" "}
            <Link href="/app/property" className="text-primary underline">
              Property
            </Link>
            .
          </p>
        </div>
      )}

      {myHouses.map((house) => {
        const people = roster.filter((r) => r.houseId === house.id);
        if (!people.length) return null;

        const unbilled = people.filter(
          (p) => !summary.get(p.id)?.billedThisWeek,
        ).length;

        return (
          <section
            key={house.id}
            className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{house.name}</h2>
              {unbilled > 0 && (
                <form action={generateWeeklyRent}>
                  <input type="hidden" name="houseId" value={house.id} />
                  <input type="hidden" name="weekStart" value={weekStart} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    <HandCoins className="h-4 w-4" />
                    Bill this week ({unbilled})
                  </button>
                </form>
              )}
            </div>

            <ul className="mt-4 space-y-3">
              {people.map((r) => {
                const s = summary.get(r.id)!;
                const weekly = weeklyCents(r.rate, r.period);
                const behind = s.balance > 0;

                return (
                  <li
                    key={r.id}
                    className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/app/residents/${r.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {r.firstName} {r.lastName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {weekly ? `${money(weekly)}/week` : "No rate set"}
                          {!s.billedThisWeek && weekly
                            ? " · not billed this week"
                            : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-semibold ${behind ? "text-red-700" : "text-accent"}`}
                        >
                          {behind
                            ? money(s.balance)
                            : s.balance === 0
                              ? "Paid up"
                              : `${money(-s.balance)} credit`}
                        </p>
                        {behind && (
                          <p className="text-xs text-muted-foreground">owing</p>
                        )}
                      </div>
                    </div>

                    {s.promise && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-primary" />
                        <span>
                          Promise to pay {money(toCents(s.promise.amount))} by{" "}
                          {fmtDateLabel(s.promise.dueBy, today)}
                          {s.promise.reason ? ` — ${s.promise.reason}` : ""}
                        </span>
                        <form action={closePromise} className="ml-auto">
                          <input
                            type="hidden"
                            name="promiseId"
                            value={s.promise.id}
                          />
                          <button
                            type="submit"
                            className="text-xs font-medium text-muted-foreground underline hover:text-primary"
                          >
                            Close
                          </button>
                        </form>
                      </div>
                    )}

                    {!canTakeMoney.has(r.id) ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-medium text-red-700">
                          Fee schedule not signed
                        </p>
                        <p className="mt-1 text-xs text-red-700/80">
                          Standard 3a requires every fee to be disclosed in
                          writing and signed before any money is taken. Payments
                          are blocked until this is done.
                        </p>
                        <Link
                          href={`/app/residents/${r.id}`}
                          className="mt-2 inline-flex text-xs font-medium text-red-700 underline"
                        >
                          Send the fee schedule
                        </Link>
                      </div>
                    ) : (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                          Record a payment
                        </summary>
                        <form
                          action={recordPayment}
                          className="mt-3 grid gap-3 sm:grid-cols-4"
                        >
                        <input
                          type="hidden"
                          name="residentId"
                          value={r.id}
                        />
                        <label className="block text-sm">
                          <span className="font-medium">Amount</span>
                          <input
                            name="amount"
                            required
                            inputMode="decimal"
                            placeholder="200"
                            className={fieldClass}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">Received</span>
                          <input
                            type="date"
                            name="receivedOn"
                            defaultValue={today}
                            className={fieldClass}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">How</span>
                          <select name="method" className={fieldClass}>
                            {Object.entries(PAYMENT_METHOD_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">
                            Paid by{" "}
                            <span className="font-normal text-muted-foreground">
                              (if not them)
                            </span>
                          </span>
                          <input
                            name="payerName"
                            placeholder="e.g. mother, church"
                            className={fieldClass}
                          />
                        </label>
                        <div className="sm:col-span-4">
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                          >
                            Save payment
                          </button>
                        </div>
                        </form>
                      </details>
                    )}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                        Add a charge or allow a promise to pay
                      </summary>

                      <form
                        action={addCharge}
                        className="mt-3 grid gap-3 sm:grid-cols-4"
                      >
                        <input type="hidden" name="residentId" value={r.id} />
                        <label className="block text-sm">
                          <span className="font-medium">Amount</span>
                          <input
                            name="amount"
                            required
                            inputMode="decimal"
                            className={fieldClass}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">For</span>
                          <select name="type" className={fieldClass}>
                            {Object.entries(CHARGE_TYPE_LABELS)
                              .filter(([v]) => v !== "rent")
                              .map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">Note</span>
                          <input name="description" className={fieldClass} />
                        </label>
                        <div className="sm:col-span-4">
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
                          >
                            Add charge
                          </button>
                        </div>
                      </form>

                      <form
                        action={grantPromise}
                        className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4"
                      >
                        <input type="hidden" name="residentId" value={r.id} />
                        <label className="block text-sm">
                          <span className="font-medium">Amount</span>
                          <input
                            name="amount"
                            required
                            inputMode="decimal"
                            defaultValue={
                              s.balance > 0
                                ? (s.balance / 100).toFixed(2)
                                : undefined
                            }
                            className={fieldClass}
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">Paid by</span>
                          <input
                            type="date"
                            name="dueBy"
                            required
                            className={fieldClass}
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-medium">Why</span>
                          <input
                            name="reason"
                            placeholder="First paycheque lands Friday"
                            className={fieldClass}
                          />
                        </label>
                        <div className="sm:col-span-4">
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
                          >
                            Allow promise to pay
                          </button>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Recorded against your name, so the reason is on file
                            if it&rsquo;s ever questioned.
                          </p>
                        </div>
                      </form>
                    </details>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                        History
                      </summary>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {allPayments
                          .filter((p) => p.residentId === r.id)
                          .map((p) => (
                            <li key={p.id} className="flex gap-3">
                              <span className="w-24 shrink-0 text-muted-foreground">
                                {p.receivedOn}
                              </span>
                              <span className="font-medium text-accent">
                                +{money(toCents(p.amount))}
                              </span>
                              <span className="text-muted-foreground">
                                {PAYMENT_METHOD_LABELS[p.method]}
                                {p.payerName ? ` · ${p.payerName}` : ""}
                              </span>
                            </li>
                          ))}
                        {allCharges
                          .filter((c) => c.residentId === r.id)
                          .map((c) => (
                            <li key={c.id} className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-muted-foreground">
                                {c.dueDate}
                              </span>
                              <span
                                className={
                                  c.waivedAt
                                    ? "font-medium text-muted-foreground line-through"
                                    : "font-medium"
                                }
                              >
                                {money(toCents(c.amount))}
                              </span>
                              <span className="text-muted-foreground">
                                {CHARGE_TYPE_LABELS[c.type]}
                                {c.description ? ` · ${c.description}` : ""}
                                {c.waivedAt ? " · waived" : ""}
                              </span>
                              {!c.waivedAt && (
                                <form
                                  action={waiveCharge}
                                  className="ml-auto"
                                >
                                  <input
                                    type="hidden"
                                    name="chargeId"
                                    value={c.id}
                                  />
                                  <button
                                    type="submit"
                                    className="text-xs text-muted-foreground underline hover:text-primary"
                                  >
                                    Waive
                                  </button>
                                </form>
                              )}
                              <form action={deleteCharge}>
                                <input
                                  type="hidden"
                                  name="chargeId"
                                  value={c.id}
                                />
                                <button
                                  type="submit"
                                  className="text-xs text-muted-foreground underline hover:text-red-600"
                                >
                                  Delete
                                </button>
                              </form>
                            </li>
                          ))}
                        {!allPayments.some((p) => p.residentId === r.id) &&
                          !allCharges.some((c) => c.residentId === r.id) && (
                            <li className="text-muted-foreground">
                              Nothing yet.
                            </li>
                          )}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
