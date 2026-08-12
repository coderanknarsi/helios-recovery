import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { intakeDocuments, payments } from "@/db/schema";

/**
 * Residents who have signed a fee schedule. Standard 3a ties the disclosure to
 * the first dollar taken, so this gates the first payment rather than every one.
 */
export async function residentsWithSignedFeeSchedule(
  residentIds: string[],
  orgId: string,
): Promise<Set<string>> {
  if (!residentIds.length) return new Set();
  const rows = await db
    .select({ residentId: intakeDocuments.residentId })
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.orgId, orgId),
        eq(intakeDocuments.type, "fee_schedule"),
        eq(intakeDocuments.status, "signed"),
        inArray(intakeDocuments.residentId, residentIds),
      ),
    );
  return new Set(rows.map((r) => r.residentId));
}

/** Residents who already have money on the ledger, so the gate no longer applies. */
export async function residentsWithPayments(
  residentIds: string[],
  orgId: string,
): Promise<Set<string>> {
  if (!residentIds.length) return new Set();
  const rows = await db
    .select({ residentId: payments.residentId })
    .from(payments)
    .where(
      and(
        eq(payments.orgId, orgId),
        inArray(payments.residentId, residentIds),
      ),
    );
  return new Set(rows.map((r) => r.residentId));
}

export async function canAcceptPayment(residentId: string, orgId: string) {
  const [signed, paid] = await Promise.all([
    residentsWithSignedFeeSchedule([residentId], orgId),
    residentsWithPayments([residentId], orgId),
  ]);
  return signed.has(residentId) || paid.has(residentId);
}
