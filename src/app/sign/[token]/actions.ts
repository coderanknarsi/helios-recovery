"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { residents, intakeDocuments, organizations } from "@/db/schema";
import { SIGNING_CONSENT } from "@/lib/esign";
import { finalizeSignedDocument } from "@/lib/sign-document";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Public, token-authenticated signing. Validates the resident's signing token
 * and that the document belongs to them before recording the signature.
 */
export async function signPublicDocument(formData: FormData) {
  const token = field(formData, "token");
  const docId = field(formData, "docId");
  const signedName = field(formData, "signedName");
  const agree = formData.get("agree");
  if (!token || !docId || !signedName) return;
  if (agree !== "on" && agree !== "true") return;

  const [resident] = await db
    .select({ id: residents.id, orgId: residents.orgId })
    .from(residents)
    .where(
      and(
        eq(residents.signToken, token),
        gt(residents.signTokenExpiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!resident) return;

  const [doc] = await db
    .select()
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.id, docId),
        eq(intakeDocuments.residentId, resident.id),
        eq(intakeDocuments.orgId, resident.orgId),
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
    .where(eq(organizations.id, resident.orgId))
    .limit(1);

  const signedAt = new Date();

  // Generate a court-provable signed copy (stamped original + certificate).
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

  revalidatePath(`/sign/${token}`);
}
