import { and, asc, eq } from "drizzle-orm";
import {
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db";
import { intakeDocuments } from "@/db/schema";
import { signedDocumentUrl } from "@/lib/documents-storage";
import { SIGNING_CONSENT } from "@/lib/esign";
import { requireResident } from "@/lib/resident-access";
import { signMyDocument } from "./actions";

export const dynamic = "force-dynamic";

function fmtDateTime(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function ResidentDocumentsPage() {
  const me = await requireResident();

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, me.residentId),
        eq(intakeDocuments.orgId, me.orgId),
      ),
    )
    .orderBy(asc(intakeDocuments.createdAt));

  // Short-lived signed URLs for the originals and for the completed copies.
  const originals = new Map(
    await Promise.all(
      docs
        .filter((d) => d.storagePath)
        .map(
          async (d) => [d.id, await signedDocumentUrl(d.storagePath!)] as const,
        ),
    ),
  );
  const copies = new Map(
    await Promise.all(
      docs
        .filter((d) => d.signedStoragePath)
        .map(
          async (d) =>
            [d.id, await signedDocumentUrl(d.signedStoragePath!)] as const,
        ),
    ),
  );

  const signedCount = docs.filter((d) => d.status === "signed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you&rsquo;ve signed, and anything still waiting on you.
        </p>
      </div>

      {docs.length > 0 && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
            signedCount === docs.length
              ? "bg-accent/10 text-accent"
              : "bg-primary/10 text-primary"
          }`}
        >
          {signedCount === docs.length && <CheckCircle2 className="h-4 w-4" />}
          {signedCount} of {docs.length} signed
        </span>
      )}

      {docs.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-sm text-muted-foreground">
            You don&rsquo;t have any documents yet. Your house team will add
            them here.
          </p>
        </div>
      )}

      {docs.map((doc) => {
        const signed = doc.status === "signed";
        return (
          <section
            key={doc.id}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                {signed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
                ) : (
                  <FileSignature className="h-5 w-5 shrink-0 text-primary" />
                )}
                {doc.title}
              </h2>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  signed
                    ? "bg-accent/10 text-accent"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {signed ? "Signed" : "Needs signature"}
              </span>
            </div>

            <div className="mt-4">
              {doc.storagePath ? (
                <a
                  href={originals.get(doc.id) ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  Open &amp; read this document
                </a>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-4 whitespace-pre-wrap text-sm leading-7">
                  {doc.body}
                </div>
              )}
            </div>

            {signed ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2 rounded-lg bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>
                    Signed by{" "}
                    <span className="font-medium text-foreground">
                      {doc.signedName}
                    </span>{" "}
                    on {fmtDateTime(doc.signedAt)}
                  </span>
                </div>
                {copies.get(doc.id) && (
                  <a
                    href={copies.get(doc.id) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    Download your signed copy
                  </a>
                )}
              </div>
            ) : (
              <form action={signMyDocument} className="mt-4">
                <input type="hidden" name="docId" value={doc.id} />

                <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/40 p-4">
                  <input
                    type="checkbox"
                    name="agree"
                    required
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
                  />
                  <span className="text-sm text-muted-foreground">
                    {SIGNING_CONSENT}
                  </span>
                </label>

                <div className="mt-3">
                  <label
                    htmlFor={`name-${doc.id}`}
                    className="text-sm font-medium"
                  >
                    Full legal name
                  </label>
                  <input
                    id={`name-${doc.id}`}
                    name="signedName"
                    required
                    autoComplete="name"
                    defaultValue={`${me.firstName} ${me.lastName}`}
                    placeholder="Type your full name"
                    className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                >
                  Sign this document
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
