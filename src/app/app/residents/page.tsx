import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { residents, beds } from "@/db/schema";
import { getAccess } from "@/lib/access";

export const metadata: Metadata = { title: "Residents" };

function fmtDate(value: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  discharged: "bg-surface-muted text-muted-foreground",
  alumni: "bg-primary/10 text-primary",
  rejected: "bg-red-50 text-red-600",
};

export default async function ResidentsPage() {
  const access = await getAccess();
  const orgId = access.orgId;

  let rows: (typeof residents.$inferSelect)[] = [];
  if (access.isAdmin) {
    rows = await db
      .select()
      .from(residents)
      .where(and(eq(residents.orgId, orgId), ne(residents.status, "prospect")))
      .orderBy(desc(residents.createdAt));
  } else if ((access.houseIds ?? []).length > 0) {
    // Managers see only residents placed in one of their houses.
    const scopedBeds = await db
      .select({ id: beds.id })
      .from(beds)
      .where(inArray(beds.houseId, access.houseIds!));
    const bedIds = scopedBeds.map((b) => b.id);
    if (bedIds.length > 0) {
      rows = await db
        .select()
        .from(residents)
        .where(
          and(
            eq(residents.orgId, orgId),
            ne(residents.status, "prospect"),
            inArray(residents.bedId, bedIds),
          ),
        )
        .orderBy(desc(residents.createdAt));
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Residents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone admitted to your program, past and present.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No residents yet. Accept an application in{" "}
            <span className="font-medium text-foreground">Admissions</span> to
            add your first resident.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">
                  Contact
                </th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">
                  Admitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted/40">
                  <td className="px-5 py-3.5 font-medium">
                    <Link
                      href={`/app/residents/${r.id}`}
                      className="text-foreground transition hover:text-primary"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        statusStyles[r.status] ??
                        "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3.5 text-muted-foreground sm:table-cell">
                    {r.phone ?? r.email ?? "—"}
                  </td>
                  <td className="hidden px-5 py-3.5 text-muted-foreground md:table-cell">
                    {fmtDate(r.admitDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
