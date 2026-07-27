import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { CheckCircle2, ShieldCheck, FileSignature, FileText } from "lucide-react";
import { db } from "@/db";
import { residents, intakeDocuments, organizations } from "@/db/schema";
import { Logo } from "@/components/logo";
import { signedDocumentUrl } from "@/lib/documents-storage";
import { SIGNING_CONSENT } from "@/lib/esign";
import { signPublicDocument } from "./actions";

export const metadata: Metadata = {
  title: "Sign your documents",
  robots: { index: false, follow: false },
};

// Always render fresh so newly-signed documents reflect immediately.
export const dynamic = "force-dynamic";

function fmtDateTime(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function InvalidLink() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Logo className="h-8 w-auto" />
      <h1 className="mt-6 text-2xl font-semibold">This link isn&apos;t valid</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This signing link has expired or is no longer active. Please contact the
        house team to request a new link.
      </p>
    </main>
  );
}

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [resident] = await db
    .select({
      id: residents.id,
      orgId: residents.orgId,
      firstName: residents.firstName,
      expiresAt: residents.signTokenExpiresAt,
    })
    .from(residents)
    .where(eq(residents.signToken, token))
    .limit(1);

  const valid =
    resident &&
    resident.expiresAt &&
    resident.expiresAt.getTime() > Date.now();
  if (!valid) return <InvalidLink />;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, resident.orgId!))
    .limit(1);

  const docs = await db
    .select()
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, resident.id),
        eq(intakeDocuments.orgId, resident.orgId!),
      ),
    )
    .orderBy(asc(intakeDocuments.createdAt));

  const signedCount = docs.filter((d) => d.status === "signed").length;
  const allSigned = docs.length > 0 && signedCount === docs.length;

  // Pre-sign short-lived URLs for any uploaded PDF documents.
  const urlEntries = await Promise.all(
    docs
      .filter((d) => d.storagePath)
      .map(
        async (d) =>
          [d.id, await signedDocumentUrl(d.storagePath!)] as const,
      ),
  );
  const signedUrls = new Map(urlEntries);

  // Pre-sign URLs for the generated signed copies (with certificate).
  const copyEntries = await Promise.all(
    docs
      .filter((d) => d.signedStoragePath)
      .map(
        async (d) =>
          [d.id, await signedDocumentUrl(d.signedStoragePath!)] as const,
      ),
  );
  const signedCopyUrls = new Map(copyEntries);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="flex items-center justify-between">
        <Logo className="h-8 w-auto" />
        <span className="text-sm text-muted-foreground">
          {org?.name ?? "Helios Recovery Residences"}
        </span>
      </div>

      <h1 className="mt-8 text-2xl font-semibold sm:text-3xl">
        Hi {resident.firstName}, please review &amp; sign
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {allSigned
          ? "You've signed everything — thank you! You can close this page."
          : "Read each document, then type your name to sign. It only takes a few minutes."}
      </p>

      {docs.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm font-medium">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
              allSigned
                ? "bg-accent/10 text-accent"
                : "bg-primary/10 text-primary"
            }`}
          >
            {allSigned && <CheckCircle2 className="h-4 w-4" />}
            {signedCount} of {docs.length} signed
          </span>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {docs.map((doc) => {
          const signed = doc.status === "signed";
          return (
            <section
              key={doc.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  {signed ? (
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                  ) : (
                    <FileSignature className="h-5 w-5 text-primary" />
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

              <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-4">
                {doc.storagePath ? (
                  <a
                    href={signedUrls.get(doc.id) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    <FileText className="h-4 w-4" />
                    Open &amp; read this document (PDF)
                  </a>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {doc.body}
                  </div>
                )}
              </div>

              {signed ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-lg bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                    Signed by{" "}
                    <span className="font-medium text-foreground">
                      {doc.signedName}
                    </span>{" "}
                    on {fmtDateTime(doc.signedAt)}
                  </div>
                  {signedCopyUrls.get(doc.id) && (
                    <a
                      href={signedCopyUrls.get(doc.id) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                      Download your signed copy (with certificate)
                    </a>
                  )}
                </div>
              ) : (
                <form action={signPublicDocument} className="mt-4">
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="docId" value={doc.id} />

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/40 p-4">
                    <input
                      type="checkbox"
                      name="agree"
                      required
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">
                      {SIGNING_CONSENT}
                    </span>
                  </label>

                  <div className="mt-3 sm:max-w-sm">
                    <label
                      htmlFor={`name-${doc.id}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Full legal name
                    </label>
                    <input
                      id={`name-${doc.id}`}
                      name="signedName"
                      required
                      autoComplete="name"
                      placeholder="Type your full name"
                      className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
                    />
                  </div>

                  <button
                    type="submit"
                    className="mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    Sign this document
                  </button>
                </form>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        This is a secure signing link intended only for {resident.firstName}.
      </p>
    </main>
  );
}
