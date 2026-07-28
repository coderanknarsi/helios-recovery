"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { intakeDocuments, organizations } from "@/db/schema";
import { SIGNING_CONSENT } from "@/lib/esign";
import { requireResident } from "@/lib/resident-access";
import { finalizeSignedDocument } from "@/lib/sign-document";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Sign a document from inside the resident portal. The resident is taken from
 * the session — never from the form — so a resident can only ever sign their
 * own paperwork.
 */
export async function signMyDocument(formData: FormData) {
  const me = await requireResident();

  const docId = field(formData, "docId");
  const signedName = field(formData, "signedName");
  const agree = formData.get("agree");
  if (!docId || !signedName) return;
  if (agree !== "on" && agree !== "true") return;

  const [doc] = await db
    .select()
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.id, docId),
        eq(intakeDocuments.residentId, me.residentId),
        eq(intakeDocuments.orgId, me.orgId),
      ),
    )
    .limit(1);
  if (!doc || doc.status === "signed") return;

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent");

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, me.orgId))
    .limit(1);

  const signedAt = new Date();

  // Generate the court-provable signed copy (stamped original + certificate).
  // Never block the signature itself on PDF generation.
  let signedStoragePath: string | null = null;
  let originalHash: string | null = null;
  let signedHash: string | null = null;
  try {
    const result = await finalizeSignedDocument({
      doc,
      orgName: org?.name ?? "Helios Recovery Residences",
      signedName,
      signedAt,
      ip,
      userAgent,
    });
    signedStoragePath = result.signedStoragePath;
    originalHash = result.originalHash;
    signedHash = result.signedHash;
  } catch (err) {
    console.error("Signed-copy generation failed:", err);
  }

  await db
    .update(intakeDocuments)
    .set({
      status: "signed",
      signedName,
      signedAt,
      signedIp: ip,
      signedUserAgent: userAgent,
      consentText: SIGNING_CONSENT,
      originalHash,
      signedStoragePath,
      signedHash,
    })
    .where(eq(intakeDocuments.id, docId));

  revalidatePath("/me/documents");
  revalidatePath("/me");
  revalidatePath(`/app/residents/${me.residentId}`);
}
