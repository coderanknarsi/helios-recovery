"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentTemplates, type IntakeDocument } from "@/db/schema";
import { getAccess } from "@/lib/access";
import { uploadDocumentFile, deleteDocumentFile } from "@/lib/documents-storage";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const DOC_TYPES: IntakeDocument["type"][] = [
  "lease_agreement",
  "fee_schedule",
  "house_rules",
  "consent",
  "other",
];

export type UploadState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** Upload a PDF into the org's reusable document library (admins only). */
export async function uploadTemplate(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const access = await getAccess();
  if (!access.isAdmin) return { status: "error", message: "Not allowed." };

  const name = field(formData, "name");
  const rawType = field(formData, "type");
  const type = (DOC_TYPES as string[]).includes(rawType)
    ? (rawType as IntakeDocument["type"])
    : "other";
  const file = formData.get("file");

  if (!name) return { status: "error", message: "Give the document a name." };
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a PDF file to upload." };
  }
  if (file.type !== "application/pdf") {
    return { status: "error", message: "Only PDF files are supported." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { status: "error", message: "That file is too large (20MB max)." };
  }

  const path = `${access.orgId}/templates/${randomUUID()}.pdf`;
  try {
    await uploadDocumentFile(path, file);
  } catch (err) {
    console.error("[documents] upload failed", err);
    return { status: "error", message: "Upload failed. Please try again." };
  }

  await db.insert(documentTemplates).values({
    orgId: access.orgId,
    name,
    type,
    storagePath: path,
    fileName: file.name,
    sizeBytes: file.size,
    createdBy: access.profile.id,
  });

  revalidatePath("/app/documents");
  return { status: "success", message: `Uploaded "${name}".` };
}

/** Delete a document from the library and its stored file (admins only). */
export async function deleteTemplate(formData: FormData) {
  const access = await getAccess();
  if (!access.isAdmin) return;
  const id = field(formData, "id");
  if (!id) return;

  const [tpl] = await db
    .select({ storagePath: documentTemplates.storagePath })
    .from(documentTemplates)
    .where(
      and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!tpl) return;

  await db
    .delete(documentTemplates)
    .where(
      and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.orgId, access.orgId),
      ),
    );
  await deleteDocumentFile(tpl.storagePath);

  revalidatePath("/app/documents");
}
