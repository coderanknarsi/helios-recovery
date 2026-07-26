import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  ArrowLeft,
  BedDouble,
  Phone,
  Mail,
  Trash2,
  ClipboardList,
  FileSignature,
  FileCheck2,
  ChevronRight,
} from "lucide-react";
import { db } from "@/db";
import {
  residents,
  beds,
  rooms,
  houses,
  residentLogs,
  intakeDocuments,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import { siteConfig } from "@/lib/site";
import { AddLogForm } from "./add-log-form";
import { assignBed, deleteLog, dischargeResident, setExpectedDeparture } from "./actions";
import {
  generateIntakePacket,
  resetIntakePacket,
} from "./documents/actions";
import { EmailLinkForm } from "./documents/email-link-form";

export const metadata: Metadata = { title: "Resident" };

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
  prospect: "bg-blue-50 text-blue-700",
};

const logTypeStyles: Record<string, string> = {
  note: "bg-surface-muted text-muted-foreground",
  drug_test: "bg-blue-50 text-blue-700",
  infraction: "bg-red-50 text-red-700",
  pass: "bg-primary/10 text-primary",
  chore: "bg-accent/10 text-accent",
  medication: "bg-accent/10 text-accent",
};

const logTypeLabels: Record<string, string> = {
  note: "Note",
  drug_test: "Drug test",
  infraction: "Infraction",
  pass: "Overnight pass",
  chore: "Chore",
  medication: "Medication",
};

const resultStyles: Record<string, string> = {
  pass: "bg-accent/10 text-accent",
  fail: "bg-red-50 text-red-700",
  refused: "bg-red-50 text-red-700",
  pending: "bg-surface-muted text-muted-foreground",
};

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

export default async function ResidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getAccess();
  const orgId = access.orgId;

  const [resident] = await db
    .select()
    .from(residents)
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);

  if (!resident) notFound();

  // Managers may only view residents placed in one of their assigned houses.
  if (!access.isAdmin) {
    const allowed = access.houseIds ?? [];
    let houseId: string | null = null;
    if (resident.bedId) {
      const [b] = await db
        .select({ houseId: beds.houseId })
        .from(beds)
        .where(eq(beds.id, resident.bedId))
        .limit(1);
      houseId = b?.houseId ?? null;
    }
    if (!houseId || !allowed.includes(houseId)) notFound();
  }

  const [currentBed, logs, availableBeds] = await Promise.all([
    resident.bedId
      ? db
          .select({
            label: beds.label,
            room: rooms.name,
            house: houses.name,
          })
          .from(beds)
          .innerJoin(rooms, eq(beds.roomId, rooms.id))
          .innerJoin(houses, eq(beds.houseId, houses.id))
          .where(eq(beds.id, resident.bedId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(residentLogs)
      .where(eq(residentLogs.residentId, id))
      .orderBy(desc(residentLogs.occurredAt), desc(residentLogs.createdAt)),
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
      .where(
        access.isAdmin
          ? and(eq(houses.orgId, orgId), eq(beds.status, "available"))
          : and(
              eq(houses.orgId, orgId),
              eq(beds.status, "available"),
              inArray(beds.houseId, access.houseIds ?? []),
            ),
      ),
  ]);

  const documents = await db
    .select({
      id: intakeDocuments.id,
      type: intakeDocuments.type,
      title: intakeDocuments.title,
      status: intakeDocuments.status,
      signedName: intakeDocuments.signedName,
      signedAt: intakeDocuments.signedAt,
    })
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, id),
        eq(intakeDocuments.orgId, orgId),
      ),
    )
    .orderBy(desc(intakeDocuments.createdAt));
  const signedCount = documents.filter((d) => d.status === "signed").length;

  const linkActive =
    !!resident.signToken &&
    !!resident.signTokenExpiresAt &&
    resident.signTokenExpiresAt.getTime() > Date.now();
  const activeLink = linkActive
    ? `${siteConfig.url}/sign/${resident.signToken}`
    : null;

  const bed = currentBed[0];
  const isActive = resident.status === "active";

  const contactLine = [
    resident.emergencyContactName,
    resident.emergencyContactPhone,
    resident.emergencyContactRelation
      ? `(${resident.emergencyContactRelation})`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/residents"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Residents
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">
              {resident.firstName} {resident.lastName}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                statusStyles[resident.status] ??
                "bg-surface-muted text-muted-foreground"
              }`}
            >
              {resident.status}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {resident.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {resident.phone}
              </span>
            )}
            {resident.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {resident.email}
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <form action={dischargeResident}>
            <input type="hidden" name="residentId" value={resident.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition hover:bg-surface-muted hover:text-red-600"
            >
              Discharge
            </button>
          </form>
        )}
      </div>

      {/* Bed assignment */}
      <div className="mt-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <BedDouble className="h-4 w-4 text-muted-foreground" />
            {bed ? (
              <span>
                <span className="font-medium">{bed.house}</span> · {bed.room} ·{" "}
                {bed.label}
              </span>
            ) : (
              <span className="text-muted-foreground">No bed assigned</span>
            )}
          </div>
          {isActive && availableBeds.length > 0 && (
            <form action={assignBed} className="flex items-center gap-2">
              <input type="hidden" name="residentId" value={resident.id} />
              <select
                name="bedId"
                required
                defaultValue=""
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              >
                <option value="" disabled>
                  {bed ? "Move to bed…" : "Assign a bed…"}
                </option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.house} — {b.room} · {b.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted"
              >
                {bed ? "Move" : "Assign"}
              </button>
            </form>
          )}
        </div>

        {isActive && (
          <form
            action={setExpectedDeparture}
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
          >
            <input type="hidden" name="residentId" value={resident.id} />
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Expected move-out (optional)
              </span>
              <input
                type="date"
                name="expectedDepartureDate"
                defaultValue={
                  typeof resident.expectedDepartureDate === "string"
                    ? resident.expectedDepartureDate
                    : ""
                }
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:bg-surface-muted"
            >
              Save
            </button>
            <span className="text-xs text-muted-foreground">
              Just an estimate for planning — leave blank for open-ended stays.
            </span>
          </form>
        )}
      </div>

      {/* Profile details */}
      <div className="mt-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Profile</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Detail label="Admitted" value={fmtDate(resident.admitDate)} />
          {resident.dischargeDate && (
            <Detail
              label="Discharged"
              value={fmtDate(resident.dischargeDate)}
            />
          )}
          <Detail label="Date of birth" value={fmtDate(resident.dateOfBirth)} />
          <Detail label="Sobriety date" value={fmtDate(resident.sobrietyDate)} />
          <Detail label="Funding source" value={resident.fundingSource} />
          <Detail label="Substances" value={resident.substances} />
          <Detail label="Referral source" value={resident.referralSource} />
          <Detail label="Treatment history" value={resident.treatmentHistory} />
          <Detail label="Medications" value={resident.medications} />
          <Detail label="Legal history" value={resident.legalHistory} />
          <Detail label="Emergency contact" value={contactLine || null} />
          <Detail label="Notes" value={resident.notes} />
        </dl>
      </div>

      {/* Intake documents */}
      <div className="mt-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            Intake documents
          </h2>
          {documents.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {signedCount} of {documents.length} signed
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No intake packet yet. Generate a pre-filled Lease, House Rules, and
              Consent form for {resident.firstName} to review and sign.
            </p>
            <form action={generateIntakePacket} className="mt-4">
              <input type="hidden" name="residentId" value={resident.id} />
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Generate intake packet
              </button>
            </form>
            <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
              These are starter templates pre-filled with this resident&apos;s
              details. Review the wording with your own counsel before relying
              on them.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-2">
              {documents.map((d) => {
                const signed = d.status === "signed";
                return (
                  <li key={d.id}>
                    <Link
                      href={`/app/residents/${resident.id}/documents/${d.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition hover:border-primary/40"
                    >
                      <span className="flex items-center gap-3">
                        {signed ? (
                          <FileCheck2 className="h-4 w-4 text-accent" />
                        ) : (
                          <FileSignature className="h-4 w-4 text-primary" />
                        )}
                        <span>
                          <span className="block text-sm font-medium">
                            {d.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {signed
                              ? `Signed by ${d.signedName} · ${fmtDate(d.signedAt)}`
                              : "Awaiting signature"}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            signed
                              ? "bg-accent/10 text-accent"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {signed ? "Signed" : "Review & sign"}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <EmailLinkForm
              residentId={resident.id}
              hasEmail={!!resident.email}
              activeLink={activeLink}
            />
            {access.isAdmin && (
              <form action={resetIntakePacket} className="mt-4">
                <input type="hidden" name="residentId" value={resident.id} />
                <button
                  type="submit"
                  className="text-xs font-medium text-muted-foreground transition hover:text-red-600"
                >
                  Reset packet (delete &amp; regenerate)
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Logs */}
      <div className="mt-5 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          Activity log
        </h2>

        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <AddLogForm residentId={resident.id} />
        </div>

        {logs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No entries yet. Record drug tests, infractions, passes, chores, and
            notes above.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        logTypeStyles[log.type] ??
                        "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      {logTypeLabels[log.type] ?? log.type}
                    </span>
                    {log.result && (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                          resultStyles[log.result] ??
                          "bg-surface-muted text-muted-foreground"
                        }`}
                      >
                        {log.result}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(log.occurredAt)}
                    </span>
                  </div>
                  {log.title && (
                    <div className="mt-1 text-sm font-medium">{log.title}</div>
                  )}
                  {log.detail && (
                    <div className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                      {log.detail}
                    </div>
                  )}
                </div>
                <form action={deleteLog}>
                  <input type="hidden" name="logId" value={log.id} />
                  <input
                    type="hidden"
                    name="residentId"
                    value={resident.id}
                  />
                  <button
                    type="submit"
                    title="Delete entry"
                    className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
