import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { FileText, Trash2, FileCheck2 } from "lucide-react";
import { db } from "@/db";
import { documentTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/access";
import { DocumentUploadForm } from "./document-upload-form";
import { deleteTemplate } from "./actions";

export const metadata: Metadata = { title: "Documents" };

const TYPE_LABELS: Record<string, string> = {
  lease_agreement: "Lease agreement",
  house_rules: "House rules",
  consent: "Consent form",
  other: "Other",
};

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const access = await requireAdmin();

  const templates = await db
    .select()
    .from(documentTemplates)
    .where(eq(documentTemplates.orgId, access.orgId))
    .orderBy(asc(documentTemplates.sortOrder), asc(documentTemplates.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your reusable document library. Upload your Lease, House Rules, Consent,
        and any custom forms once — then send them to residents for e-signature
        from their profile.
      </p>

      <div className="mt-6">
        <DocumentUploadForm />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Your documents
          {templates.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({templates.length})
            </span>
          )}
        </h2>

        {templates.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload your first PDF above to start building
              your library.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {TYPE_LABELS[t.type] ?? "Other"} · {t.fileName}
                      {fmtSize(t.sizeBytes) ? ` · ${fmtSize(t.sizeBytes)}` : ""}
                    </span>
                  </span>
                </span>
                <form action={deleteTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
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
