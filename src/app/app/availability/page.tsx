import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  CalendarRange,
  BedDouble,
  DoorOpen,
  LogOut,
  LogIn,
  Wrench,
  ArrowRight,
  Clock,
  Phone,
  Mail,
} from "lucide-react";
import { db } from "@/db";
import { beds, rooms, houses, residents } from "@/db/schema";
import { getAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Availability" };

function fmtDate(value: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + "T00:00:00") : value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole-day difference from today (negative = in the past). */
function daysFromToday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function relativeLabel(dateStr: string) {
  const diff = daysFromToday(dateStr);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return "in ~1 week";
  if (diff < 45) return `in ~${Math.round(diff / 7)} weeks`;
  return `in ~${Math.round(diff / 30)} months`;
}

type Cell = {
  bedId: string;
  bedLabel: string;
  status: string;
  roomName: string;
  houseId: string;
  houseName: string;
  residentId: string | null;
  residentName: string | null;
  residentPhone: string | null;
  residentEmail: string | null;
  admitDate: string | null;
  expectedDepartureDate: string | null;
  desiredMoveInDate: string | null;
};

export default async function AvailabilityPage() {
  const access = await getAccess();
  const orgId = access.orgId;
  const { isAdmin, houseIds } = access;
  const scopedEmpty = !isAdmin && (houseIds ?? []).length === 0;

  const bedRows = scopedEmpty
    ? []
    : await db
        .select({
          bedId: beds.id,
          bedLabel: beds.label,
          status: beds.status,
          roomName: rooms.name,
          houseId: houses.id,
          houseName: houses.name,
        })
        .from(beds)
        .innerJoin(rooms, eq(beds.roomId, rooms.id))
        .innerJoin(houses, eq(beds.houseId, houses.id))
        .where(
          isAdmin
            ? eq(houses.orgId, orgId)
            : and(
                eq(houses.orgId, orgId),
                inArray(houses.id, houseIds ?? []),
              ),
        )
        .orderBy(asc(houses.name), asc(rooms.name), asc(beds.label));

  const occupants = scopedEmpty
    ? []
    : await db
        .select({
          id: residents.id,
          firstName: residents.firstName,
          lastName: residents.lastName,
          phone: residents.phone,
          email: residents.email,
          status: residents.status,
          bedId: residents.bedId,
          admitDate: residents.admitDate,
          expectedDepartureDate: residents.expectedDepartureDate,
          desiredMoveInDate: residents.desiredMoveInDate,
        })
        .from(residents)
        .where(
          and(
            eq(residents.orgId, orgId),
            isNotNull(residents.bedId),
            inArray(residents.status, ["active", "prospect"]),
          ),
        );

  const occByBed = new Map<string, (typeof occupants)[number]>();
  for (const o of occupants) {
    if (o.bedId) occByBed.set(o.bedId, o);
  }

  const cells: Cell[] = bedRows.map((b) => {
    const occ = occByBed.get(b.bedId);
    return {
      bedId: b.bedId,
      bedLabel: b.bedLabel,
      status: b.status,
      roomName: b.roomName,
      houseId: b.houseId,
      houseName: b.houseName,
      residentId: occ?.id ?? null,
      residentName: occ ? `${occ.firstName} ${occ.lastName}` : null,
      residentPhone: occ?.phone ?? null,
      residentEmail: occ?.email ?? null,
      admitDate: occ?.admitDate ?? null,
      expectedDepartureDate: occ?.expectedDepartureDate ?? null,
      desiredMoveInDate: occ?.desiredMoveInDate ?? null,
    };
  });

  const total = cells.length;
  const openNow = cells.filter((c) => c.status === "available").length;
  const occupied = cells.filter((c) => c.status === "occupied").length;
  const reserved = cells.filter((c) => c.status === "reserved").length;

  // Forecast: upcoming move-outs (free up beds) and move-ins (fill beds).
  const departures = cells
    .filter((c) => c.status === "occupied" && c.expectedDepartureDate)
    .sort((a, b) =>
      (a.expectedDepartureDate ?? "").localeCompare(
        b.expectedDepartureDate ?? "",
      ),
    );
  const arrivals = cells
    .filter((c) => c.status === "reserved" && c.desiredMoveInDate)
    .sort((a, b) =>
      (a.desiredMoveInDate ?? "").localeCompare(b.desiredMoveInDate ?? ""),
    );

  const openingSoon = departures.filter(
    (c) => daysFromToday(c.expectedDepartureDate!) <= 30,
  ).length;

  // Group cells by house for the board.
  const byHouse = new Map<string, { name: string; cells: Cell[] }>();
  for (const c of cells) {
    const entry = byHouse.get(c.houseId) ?? { name: c.houseName, cells: [] };
    entry.cells.push(c);
    byHouse.set(c.houseId, entry);
  }
  const houseGroups = [...byHouse.values()];

  // Near-term horizon for the day-by-day strip (today + next 13 days).
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });

  const stats = [
    { label: "Total beds", value: total, accent: "text-foreground bg-surface-muted" },
    { label: "Open now", value: openNow, accent: "text-accent bg-accent/10" },
    { label: "Opening ≤30d", value: openingSoon, accent: "text-primary bg-primary/10" },
    { label: "Reserved", value: reserved, accent: "text-primary bg-primary/10" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <CalendarRange className="h-6 w-6 text-muted-foreground" />
        Availability
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A live look at every bed — who&apos;s in it, when it might open, and
        what&apos;s coming in — so you can plan for incoming guests.
      </p>

      {total === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No beds to show yet. Add houses, rooms, and beds under{" "}
            <span className="font-medium text-foreground">Property</span> to see
            availability here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.accent}`}
                >
                  <BedDouble className="h-5 w-5" />
                </div>
                <p className="mt-3 text-3xl font-semibold">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* 14-day strip */}
          <DayStrip houseGroups={houseGroups} days={days} />

          {/* Forecast */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <LogOut className="h-4 w-4 text-accent" />
                Upcoming openings
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Beds expected to free up, soonest first.
              </p>
              {departures.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No expected move-outs on the calendar. Add an estimated
                  move-out on a resident when they give notice.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {departures.map((c) => (
                    <li key={c.bedId}>
                      <Link
                        href={`/app/residents/${c.residentId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition hover:border-primary/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {c.residentName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.houseName} · {c.roomName} · {c.bedLabel}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-medium">
                            {fmtDate(c.expectedDepartureDate)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${
                              daysFromToday(c.expectedDepartureDate!) < 0
                                ? "text-red-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {relativeLabel(c.expectedDepartureDate!)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin && (
                <Link
                  href="/app/admissions"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Match with the waitlist
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <LogIn className="h-4 w-4 text-primary" />
                Upcoming move-ins
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reserved beds with an incoming guest.
              </p>
              {arrivals.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No reserved beds right now. Hold a bed for an incoming guest
                  from Admissions.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {arrivals.map((c) => (
                    <li key={c.bedId}>
                      <Link
                        href={`/app/residents/${c.residentId}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition hover:border-primary/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {c.residentName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.houseName} · {c.roomName} · {c.bedLabel}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-medium">
                            {fmtDate(c.desiredMoveInDate)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {relativeLabel(c.desiredMoveInDate!)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Board */}
          <div className="mt-8 space-y-6">
            {houseGroups.map((group) => {
              const groupOpen = group.cells.filter(
                (c) => c.status === "available",
              ).length;
              return (
                <section
                  key={group.name}
                  className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">{group.name}</h2>
                    <span className="text-xs text-muted-foreground">
                      {groupOpen} of {group.cells.length} open
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.cells.map((c) => (
                      <BedCard key={c.bedId} cell={c} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

type DayState = "open" | "occupied" | "reserved" | "maintenance";

/** What a bed looks like on a given calendar day within the horizon. */
function cellDayStatus(cell: Cell, key: string): DayState {
  if (cell.status === "maintenance") return "maintenance";
  if (cell.status === "reserved") return "reserved";
  if (cell.status === "occupied") {
    // Frees up on/after the expected move-out estimate (if one is set).
    if (cell.expectedDepartureDate && key >= cell.expectedDepartureDate) {
      return "open";
    }
    return "occupied";
  }
  return "open";
}

const DAY_STYLES: Record<DayState, string> = {
  open: "bg-accent/20",
  occupied: "bg-surface-muted",
  reserved: "bg-primary/25",
  maintenance:
    "bg-[repeating-linear-gradient(45deg,var(--border),var(--border)_3px,transparent_3px,transparent_6px)]",
};

const DAY_LABELS: Record<DayState, string> = {
  open: "Open",
  occupied: "Occupied",
  reserved: "Reserved",
  maintenance: "Out of service",
};

function DayStrip({
  houseGroups,
  days,
}: {
  houseGroups: { name: string; cells: Cell[] }[];
  days: Date[];
}) {
  const todayKey = dayKey(days[0]);

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Next 14 days</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bed-by-day view so you can see if there&apos;s room for an intake on
            a specific date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(["open", "occupied", "reserved", "maintenance"] as DayState[]).map(
            (s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-block h-3 w-3 rounded-sm border border-border ${DAY_STYLES[s]}`}
                />
                {DAY_LABELS[s]}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface pb-2 pr-3 text-left font-medium text-muted-foreground">
                Bed
              </th>
              {days.map((d) => {
                const key = dayKey(d);
                const isToday = key === todayKey;
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th
                    key={key}
                    className={`px-0 pb-2 text-center font-medium ${
                      weekend
                        ? "text-muted-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`mx-auto flex w-8 flex-col items-center rounded-md py-0.5 ${
                        isToday ? "bg-primary/10 text-primary" : ""
                      }`}
                    >
                      <span className="text-[10px] uppercase">
                        {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                      </span>
                      <span className="text-sm font-semibold">
                        {d.getDate()}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {houseGroups.map((group) => (
              <Fragment key={group.name}>
                <tr>
                  <td
                    colSpan={days.length + 1}
                    className="sticky left-0 bg-surface pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.name}
                  </td>
                </tr>
                {group.cells.map((cell) => (
                  <tr key={cell.bedId}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface py-1 pr-3 text-foreground">
                      {cell.roomName} · {cell.bedLabel}
                    </td>
                    {days.map((d) => {
                      const key = dayKey(d);
                      const state = cellDayStatus(cell, key);
                      return (
                        <td key={key} className="p-0.5">
                          <div
                            title={`${cell.bedLabel} · ${d.toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" },
                            )}: ${DAY_LABELS[state]}`}
                            className={`mx-auto h-6 w-8 rounded-sm border border-border ${DAY_STYLES[state]}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BedCard({ cell }: { cell: Cell }) {
  const base =
    "rounded-lg border p-4 text-sm transition block h-full";

  if (cell.status === "available") {
    return (
      <div className={`${base} border-accent/30 bg-accent/5`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {cell.roomName} · {cell.bedLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            <DoorOpen className="h-3.5 w-3.5" />
            Open now
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ready for a new guest.
        </p>
      </div>
    );
  }

  if (cell.status === "maintenance") {
    return (
      <div className={`${base} border-border bg-surface-muted/50`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {cell.roomName} · {cell.bedLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
            Maintenance
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Out of service.
        </p>
      </div>
    );
  }

  if (cell.status === "reserved") {
    return (
      <Link
        href={cell.residentId ? `/app/residents/${cell.residentId}` : "#"}
        className={`${base} border-primary/30 bg-primary/5 hover:border-primary/50`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {cell.roomName} · {cell.bedLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <LogIn className="h-3.5 w-3.5" />
            Reserved
          </span>
        </div>
        <p className="mt-2 text-sm font-medium">
          {cell.residentName ?? "Incoming guest"}
        </p>
        <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
          {cell.residentPhone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0" />
              {cell.residentPhone}
            </span>
          )}
          {cell.residentEmail && (
            <span className="inline-flex items-center gap-1.5 truncate">
              <Mail className="h-3 w-3 shrink-0" />
              {cell.residentEmail}
            </span>
          )}
          <span>Arrives {fmtDate(cell.desiredMoveInDate)}</span>
        </div>
      </Link>
    );
  }

  // Occupied
  return (
    <Link
      href={cell.residentId ? `/app/residents/${cell.residentId}` : "#"}
      className={`${base} border-border bg-background hover:border-primary/40`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {cell.roomName} · {cell.bedLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Occupied
        </span>
      </div>
      <p className="mt-2 text-sm font-medium">{cell.residentName}</p>
      <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
        {cell.residentPhone && (
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />
            {cell.residentPhone}
          </span>
        )}
        {cell.residentEmail && (
          <span className="inline-flex items-center gap-1.5 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            {cell.residentEmail}
          </span>
        )}
        <div className="flex flex-wrap gap-x-3">
          <span>In {fmtDate(cell.admitDate)}</span>
          <span>
            {cell.expectedDepartureDate
              ? `Out ~${fmtDate(cell.expectedDepartureDate)}`
              : "Open-ended"}
          </span>
        </div>
      </div>
    </Link>
  );
}
