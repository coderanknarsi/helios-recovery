import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import { db } from "@/db";
import { intakeDocuments, residents, beds } from "@/db/schema";
import { getAccess } from "@/lib/access";
import { signedDocumentUrl } from "@/lib/documents-storage";
import { signDocument } from "../actions";

export const metadata: Metadata = { title: "Intake document" };

function fmtDateTime(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { id, docId } = await params;
  const access = await getAccess();
  const orgId = access.orgId;

  const [doc] = await db
    .select()
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.id, docId),
        eq(intakeDocuments.residentId, id),
        eq(intakeDocuments.orgId, orgId),
      ),
    )
    .limit(1);
  if (!doc) notFound();

  const [resident] = await db
    .select({
      firstName: residents.firstName,
      lastName: residents.lastName,
      houseId: beds.houseId,
    })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);
  if (!resident) notFound();

  // Managers may only open documents for residents in their assigned houses.
  if (!access.isAdmin) {
    const allowed = access.houseIds ?? [];
    if (!resident.houseId || !allowed.includes(resident.houseId)) notFound();
  }

  const signed = doc.status === "signed";
  const fileUrl = doc.storagePath
    ? await signedDocumentUrl(doc.storagePath)
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/app/residents/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {resident.firstName} {resident.lastName}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            signed ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
          }`}
        >
          {signed ? "Signed" : "Awaiting signature"}
        </span>
      </div>

      {/* Document body */}
      <article className="mt-5 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {doc.storagePath ? (
          <a
            href={fileUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
          >
            <FileText className="h-4 w-4" />
            Open document (PDF)
          </a>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {doc.body}
          </div>
        )}
      </article>

      {/* Signature */}
      {signed ? (
        <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Electronically signed
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Signed by
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {doc.signedName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date &amp; time
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {fmtDateTime(doc.signedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                IP address
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {doc.signedIp ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <form
          action={signDocument}
          className="mt-5 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          <input type="hidden" name="docId" value={doc.id} />
          <input type="hidden" name="residentId" value={id} />
          <h2 className="text-sm font-semibold">Sign this document</h2>

          <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-surface-muted/40 p-4">
            <input
              type="checkbox"
              name="agree"
              required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              I have read and agree to this document. I understand that typing my
              name below constitutes my legal electronic signature.
            </span>
          </label>

          <div className="mt-4 sm:max-w-sm">
            <label
              htmlFor="signedName"
              className="text-sm font-medium text-foreground"
            >
              Full legal name
            </label>
            <input
              id="signedName"
              name="signedName"
              required
              autoComplete="name"
              placeholder="Type your full name"
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <button
            type="submit"
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
          >
            Sign document
          </button>
        </form>
      )}
    </div>
  );
}
