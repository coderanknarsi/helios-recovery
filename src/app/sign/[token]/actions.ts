"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { residents, intakeDocuments } from "@/db/schema";

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
    .select({ id: intakeDocuments.id, status: intakeDocuments.status })
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

  await db
    .update(intakeDocuments)
    .set({
      status: "signed",
      signedName,
      signedAt: new Date(),
      signedIp: ip,
    })
    .where(eq(intakeDocuments.id, docId));

  revalidatePath(`/sign/${token}`);
}
