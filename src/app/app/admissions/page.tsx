import type { Metadata } from "next";
import { and, asc, desc, eq } from "drizzle-orm";
import { Phone, Mail, CalendarClock } from "lucide-react";
import { db } from "@/db";
import { residents, beds, rooms, houses } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";
import { acceptProspect, holdBed, rejectProspect } from "./actions";

export const metadata: Metadata = { title: "Admissions" };

function fmtDate(value: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type BedOption = { id: string; label: string; house: string; room: string };

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default async function AdmissionsPage() {
  const profile = await getCurrentProfile();
  const orgId = profile.orgId!;

  const [prospects, availableBeds] = await Promise.all([
    db
      .select()
      .from(residents)
      .where(and(eq(residents.orgId, orgId), eq(residents.status, "prospect")))
      .orderBy(desc(residents.createdAt)),
    db
      .select({
        id: beds.id,
        label: beds.label,
        room: rooms.name,
        house: houses.name,
      })
      .from(beds)
      .innerJoin(rooms, eq(beds.roomId, rooms.id))
      .innerJoin(houses, eq(beds.houseId, houses.id))
      .where(and(eq(houses.orgId, orgId), eq(beds.status, "available")))
      .orderBy(asc(houses.name), asc(beds.label)),
  ]);

  const bedOptions: BedOption[] = availableBeds;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Admissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review incoming applications, then accept, hold a bed, or decline.
      </p>

      {prospects.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No pending applications right now. New submissions from your{" "}
            <span className="font-medium text-foreground">Apply</span> page will
            show up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {prospects.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {p.firstName} {p.lastName}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {p.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {p.phone}
                      </span>
                    )}
                    {p.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {p.email}
                      </span>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Applied {fmtDate(p.createdAt)}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3">
                <Detail
                  label="Desired move-in"
                  value={fmtDate(p.desiredMoveInDate)}
                />
                <Detail label="Sobriety date" value={fmtDate(p.sobrietyDate)} />
                <Detail label="Date of birth" value={fmtDate(p.dateOfBirth)} />
                <Detail label="Substances" value={p.substances} />
                <Detail label="Funding source" value={p.fundingSource} />
                <Detail label="Referral source" value={p.referralSource} />
                <Detail label="Treatment history" value={p.treatmentHistory} />
                <Detail label="Medications" value={p.medications} />
                <Detail label="Legal history" value={p.legalHistory} />
                <Detail
                  label="Emergency contact"
                  value={
                    p.emergencyContactName
                      ? `${p.emergencyContactName}${
                          p.emergencyContactPhone
                            ? ` · ${p.emergencyContactPhone}`
                            : ""
                        }${
                          p.emergencyContactRelation
                            ? ` (${p.emergencyContactRelation})`
                            : ""
                        }`
                      : null
                  }
                />
                <Detail label="Notes" value={p.notes} />
              </dl>

              <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
                <form action={acceptProspect} className="flex items-end gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  {bedOptions.length > 0 && (
                    <label className="text-sm">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">
                        Assign bed (optional)
                      </span>
                      <select
                        name="bedId"
                        defaultValue=""
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                      >
                        <option value="">No bed yet</option>
                        {bedOptions.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.house} — {b.room} · {b.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:opacity-90"
                  >
                    Accept &amp; admit
                  </button>
                </form>

                {bedOptions.length > 0 && (
                  <form action={holdBed} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <select
                      name="bedId"
                      required
                      defaultValue=""
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
                    >
                      <option value="" disabled>
                        Select a bed to hold…
                      </option>
                      {bedOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.house} — {b.room} · {b.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted"
                    >
                      Hold a bed
                    </button>
                  </form>
                )}

                <form action={rejectProspect} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                  >
                    Decline
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
