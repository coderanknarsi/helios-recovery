import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, ShieldCheck, FileSignature } from "lucide-react";
import { db } from "@/db";
import {
  residents,
  beds,
  intakeDocuments,
  residentRois,
  roiDisclosures,
  profiles,
} from "@/db/schema";
import { getAccess } from "@/lib/access";
import { CONSENT_TYPE_LABELS, roiState, scopeLabel } from "@/lib/roi";
import { RoiForm } from "./roi-form";
import { DisclosureForm } from "./disclosure-form";
import { revokeRoi } from "./actions";

export const metadata: Metadata = { title: "Releases of information" };

const stateStyles: Record<string, string> = {
  active: "bg-accent/10 text-accent",
  revoked: "bg-red-50 text-red-700",
  expired: "bg-surface-muted text-muted-foreground",
};

function fmtDate(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ResidentRoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getAccess();

  const [resident] = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      houseId: beds.houseId,
    })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .where(and(eq(residents.id, id), eq(residents.orgId, access.orgId)))
    .limit(1);

  if (!resident) notFound();
  if (
    !access.isAdmin &&
    !(resident.houseId && (access.houseIds ?? []).includes(resident.houseId))
  ) {
    notFound();
  }

  const [rois, disclosures] = await Promise.all([
    db
      .select({
        id: residentRois.id,
        documentId: residentRois.documentId,
        consentType: residentRois.consentType,
        recipientName: residentRois.recipientName,
        recipientRole: residentRois.recipientRole,
        recipientOrganization: residentRois.recipientOrganization,
        recipientPhone: residentRois.recipientPhone,
        recipientEmail: residentRois.recipientEmail,
        scopes: residentRois.scopes,
        purpose: residentRois.purpose,
        expiresAt: residentRois.expiresAt,
        revokedAt: residentRois.revokedAt,
        revokedByResident: residentRois.revokedByResident,
        documentStatus: intakeDocuments.status,
      })
      .from(residentRois)
      .leftJoin(
        intakeDocuments,
        eq(residentRois.documentId, intakeDocuments.id),
      )
      .where(
        and(
          eq(residentRois.residentId, id),
          eq(residentRois.orgId, access.orgId),
        ),
      )
      .orderBy(desc(residentRois.createdAt)),
    db
      .select({
        id: roiDisclosures.id,
        roiId: roiDisclosures.roiId,
        disclosedAt: roiDisclosures.disclosedAt,
        method: roiDisclosures.method,
        scopes: roiDisclosures.scopes,
        summary: roiDisclosures.summary,
        byName: profiles.fullName,
      })
      .from(roiDisclosures)
      .leftJoin(profiles, eq(roiDisclosures.disclosedBy, profiles.id))
      .where(
        and(
          eq(roiDisclosures.residentId, id),
          eq(roiDisclosures.orgId, access.orgId),
        ),
      )
      .orderBy(desc(roiDisclosures.disclosedAt)),
  ]);

  const byRoi = new Map<string, typeof disclosures>();
  for (const d of disclosures) {
    const list = byRoi.get(d.roiId) ?? [];
    list.push(d);
    byRoi.set(d.roiId, list);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href={`/app/residents/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {resident.firstName} {resident.lastName}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold">Releases of information</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each release names one person and lists exactly what they may receive.
        Nothing may be shared until the resident signs it, and the resident can
        revoke any release at any time.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold">New release</h2>
        <div className="mt-4">
          <RoiForm residentId={id} />
        </div>
      </div>

      {rois.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No releases yet. Without one, you cannot confirm this resident lives
            here — not to a probation officer, an employer, or a parent.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {rois.map((roi) => {
            const state = roiState(roi);
            const signed = roi.documentStatus === "signed";
            const logged = byRoi.get(roi.id) ?? [];
            return (
              <li
                key={roi.id}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">
                      {roi.recipientName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {roi.recipientRole}
                      {roi.recipientOrganization
                        ? ` · ${roi.recipientOrganization}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {CONSENT_TYPE_LABELS[roi.consentType] ?? roi.consentType}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${stateStyles[state]}`}
                    >
                      {state}
                    </span>
                  </div>
                </div>

                {!signed && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                    <FileSignature className="h-4 w-4 shrink-0" />
                    Waiting on the resident&rsquo;s signature. Disclose nothing
                    until this is signed.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {roi.scopes.map((s) => (
                    <span
                      key={s}
                      className="inline-flex rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {scopeLabel(s)}
                    </span>
                  ))}
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      Purpose
                    </dt>
                    <dd className="mt-0.5">{roi.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {roi.revokedAt ? "Revoked" : "Expires"}
                    </dt>
                    <dd className="mt-0.5">
                      {roi.revokedAt
                        ? `${fmtDate(roi.revokedAt)}${
                            roi.revokedByResident ? " by the resident" : ""
                          }`
                        : fmtDate(roi.expiresAt)}
                    </dd>
                  </div>
                </dl>

                {(roi.recipientPhone || roi.recipientEmail) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {[roi.recipientPhone, roi.recipientEmail]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
                  {roi.documentId && (
                    <Link
                      href={`/app/residents/${id}/documents/${roi.documentId}`}
                      className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      View document
                    </Link>
                  )}
                  {state === "active" && signed && (
                    <DisclosureForm
                      roiId={roi.id}
                      residentId={id}
                      scopes={roi.scopes}
                    />
                  )}
                  {state === "active" && (
                    <form action={revokeRoi} className="ml-auto">
                      <input type="hidden" name="roiId" value={roi.id} />
                      <input type="hidden" name="residentId" value={id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-muted-foreground transition hover:text-red-600"
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </div>

                {logged.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      Disclosure log ({logged.length})
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {logged.map((d) => (
                        <li key={d.id} className="text-xs">
                          <span className="text-muted-foreground">
                            {fmtDateTime(d.disclosedAt)} · {d.method}
                            {d.byName ? ` · ${d.byName}` : ""}
                          </span>
                          <p className="mt-0.5">{d.summary}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            {d.scopes.map(scopeLabel).join(", ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
