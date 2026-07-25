import type { Metadata } from "next";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { residents } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";

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
  const profile = await getCurrentProfile();
  const orgId = profile.orgId!;

  const rows = await db
    .select()
    .from(residents)
    .where(and(eq(residents.orgId, orgId), ne(residents.status, "prospect")))
    .orderBy(desc(residents.createdAt));

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
                    {r.firstName} {r.lastName}
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
