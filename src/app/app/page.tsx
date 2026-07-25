import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { UserPlus, Users, Building2, BedDouble, ArrowRight } from "lucide-react";
import { db } from "@/db";
import { residents, houses, beds } from "@/db/schema";
import { getAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Overview" };

function fmtDate(value: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function OverviewPage() {
  const access = await getAccess();
  const orgId = access.orgId;
  const { isAdmin, houseIds } = access;
  const scoped = !isAdmin && (houseIds ?? []).length > 0;

  const [prospects, active, houseCount, openBeds, recent] = await Promise.all([
    // Incoming applications — admins only.
    isAdmin
      ? db
          .select({ id: residents.id })
          .from(residents)
          .where(
            and(eq(residents.orgId, orgId), eq(residents.status, "prospect")),
          )
      : Promise.resolve([]),
    // Active residents — scoped to assigned houses for managers.
    isAdmin
      ? db
          .select({ id: residents.id })
          .from(residents)
          .where(
            and(eq(residents.orgId, orgId), eq(residents.status, "active")),
          )
      : scoped
        ? db
            .select({ id: residents.id })
            .from(residents)
            .innerJoin(beds, eq(residents.bedId, beds.id))
            .where(
              and(
                eq(residents.orgId, orgId),
                eq(residents.status, "active"),
                inArray(beds.houseId, houseIds!),
              ),
            )
        : Promise.resolve([]),
    // House count.
    isAdmin
      ? db.select({ id: houses.id }).from(houses).where(eq(houses.orgId, orgId))
      : Promise.resolve((houseIds ?? []).map((id) => ({ id }))),
    // Open beds.
    isAdmin
      ? db
          .select({ id: beds.id })
          .from(beds)
          .innerJoin(houses, eq(beds.houseId, houses.id))
          .where(and(eq(houses.orgId, orgId), eq(beds.status, "available")))
      : scoped
        ? db
            .select({ id: beds.id })
            .from(beds)
            .where(
              and(
                inArray(beds.houseId, houseIds!),
                eq(beds.status, "available"),
              ),
            )
        : Promise.resolve([]),
    // Recent applications — admins only.
    isAdmin
      ? db
          .select({
            id: residents.id,
            firstName: residents.firstName,
            lastName: residents.lastName,
            createdAt: residents.createdAt,
            desiredMoveInDate: residents.desiredMoveInDate,
          })
          .from(residents)
          .where(
            and(eq(residents.orgId, orgId), eq(residents.status, "prospect")),
          )
          .orderBy(desc(residents.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ]);

  const stats = [
    ...(isAdmin
      ? [
          {
            label: "New applications",
            value: prospects.length,
            icon: UserPlus,
            href: "/app/admissions",
            accent: "text-primary bg-primary/10",
          },
        ]
      : []),
    {
      label: "Active residents",
      value: active.length,
      icon: Users,
      href: "/app/residents",
      accent: "text-accent bg-accent/10",
    },
    {
      label: "Houses",
      value: houseCount.length,
      icon: Building2,
      href: "/app/property",
      accent: "text-foreground bg-surface-muted",
    },
    {
      label: "Open beds",
      value: openBeds.length,
      icon: BedDouble,
      href: "/app/property",
      accent: "text-foreground bg-surface-muted",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A snapshot of your program today.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-primary/40"
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.accent}`}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <p className="mt-4 text-3xl font-semibold">{s.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-8 rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Recent applications</h2>
            <Link
              href="/app/admissions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No new applications yet. They&apos;ll appear here as people apply.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <span className="text-sm font-medium">
                    {r.firstName} {r.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Applied {fmtDate(r.createdAt)}
                    {r.desiredMoveInDate
                      ? ` · wants ${fmtDate(r.desiredMoveInDate)}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
