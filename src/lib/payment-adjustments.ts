import "server-only";

import { and, eq, inArray, or } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import {
  paymentDisputes,
  paymentRefunds,
  payments,
  type Payment,
} from "@/db/schema";
import { fromCents, toCents } from "@/lib/billing";
import { todayIso } from "@/lib/schedule";
import { requireStripe } from "@/lib/stripe";

function objectId(value: { id: string } | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function eventDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000);
}

async function originalPayment(
  paymentIntent: Stripe.Refund["payment_intent"] | Stripe.Dispute["payment_intent"],
  charge: Stripe.Refund["charge"] | Stripe.Dispute["charge"],
): Promise<Payment | null> {
  let paymentIntentId = objectId(paymentIntent);
  const chargeId = objectId(charge);

  if (!paymentIntentId && chargeId) {
    const [byCharge] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.kind, "receipt"),
          eq(payments.stripeChargeId, chargeId),
        ),
      )
      .limit(1);
    if (byCharge) return byCharge;

    const stripeCharge = await requireStripe().charges.retrieve(chargeId);
    if (!("deleted" in stripeCharge)) {
      paymentIntentId = objectId(stripeCharge.payment_intent);
    }
  }

  if (!paymentIntentId) return null;

  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.kind, "receipt"),
        or(
          eq(payments.stripePaymentIntentId, paymentIntentId),
          eq(payments.reference, paymentIntentId),
        ),
      ),
    )
    .limit(1);

  return payment ?? null;
}

async function assertReversalFits(payment: Payment, amountCents: number) {
  const existing = await db
    .select({ amount: payments.amount })
    .from(payments)
    .where(
      and(
        eq(payments.reversalOfId, payment.id),
        inArray(payments.kind, ["refund", "chargeback_reversal"]),
      ),
    );
  const reversedCents = existing.reduce(
    (sum, row) => sum + Math.abs(toCents(row.amount)),
    0,
  );
  if (reversedCents + amountCents > toCents(payment.amount)) {
    throw new Error(
      `Stripe adjustment exceeds original payment ${payment.id}.`,
    );
  }
}

async function ensureReversal(args: {
  payment: Payment;
  amountCents: number;
  kind: "refund" | "chargeback_reversal";
  adjustmentId: string;
  note: string;
}) {
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.stripeAdjustmentId, args.adjustmentId))
    .limit(1);
  if (existing) return existing.id;

  await assertReversalFits(args.payment, args.amountCents);
  const [created] = await db
    .insert(payments)
    .values({
      orgId: args.payment.orgId,
      residentId: args.payment.residentId,
      amount: fromCents(-args.amountCents),
      receivedOn: todayIso(),
      method: "card",
      payerName: args.payment.payerName,
      reference: args.adjustmentId,
      note: args.note,
      kind: args.kind,
      reversalOfId: args.payment.id,
      stripeAdjustmentId: args.adjustmentId,
    })
    .onConflictDoNothing()
    .returning({ id: payments.id });
  if (created) return created.id;

  const [raced] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.stripeAdjustmentId, args.adjustmentId))
    .limit(1);
  if (!raced) throw new Error(`Could not reconcile ${args.adjustmentId}.`);
  return raced.id;
}

export async function reconcileRefund(
  refund: Stripe.Refund,
  stripeEventCreated: number,
) {
  const payment = await originalPayment(refund.payment_intent, refund.charge);
  if (!payment) {
    throw new Error(`No Helios payment matches Stripe refund ${refund.id}.`);
  }

  const requestKey = refund.metadata?.heliosRefundRequestId || null;
  const [existing] = await db
    .select()
    .from(paymentRefunds)
    .where(
      requestKey
        ? or(
            eq(paymentRefunds.stripeRefundId, refund.id),
            eq(paymentRefunds.requestKey, requestKey),
          )
        : eq(paymentRefunds.stripeRefundId, refund.id),
    )
    .limit(1);
  const eventAt = eventDate(stripeEventCreated);
  if (
    existing?.stripeEventCreatedAt &&
    existing.stripeEventCreatedAt > eventAt
  ) {
    return;
  }

  let refundRowId = existing?.id;
  if (existing) {
    await db
      .update(paymentRefunds)
      .set({
        stripeRefundId: refund.id,
        status: refund.status ?? "unknown",
        failureReason: refund.failure_reason,
        stripeEventCreatedAt: eventAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.id, existing.id));
  } else {
    const [created] = await db
      .insert(paymentRefunds)
      .values({
        orgId: payment.orgId,
        paymentId: payment.id,
        requestKey,
        stripeRefundId: refund.id,
        amount: fromCents(refund.amount),
        status: refund.status ?? "unknown",
        reason: "other",
        staffNote: "Refund initiated outside Helios.",
        failureReason: refund.failure_reason,
        stripeEventCreatedAt: eventAt,
      })
      .returning({ id: paymentRefunds.id });
    refundRowId = created.id;
  }

  if (refund.status === "succeeded") {
    const reversalPaymentId = await ensureReversal({
      payment,
      amountCents: refund.amount,
      kind: "refund",
      adjustmentId: refund.id,
      note: "Card refund",
    });
    await db
      .update(paymentRefunds)
      .set({ reversalPaymentId, updatedAt: new Date() })
      .where(eq(paymentRefunds.id, refundRowId!));
  }
}

export async function reconcileDispute(
  dispute: Stripe.Dispute,
  stripeEventCreated: number,
) {
  const payment = await originalPayment(dispute.payment_intent, dispute.charge);
  if (!payment) {
    throw new Error(`No Helios payment matches Stripe dispute ${dispute.id}.`);
  }

  const [existing] = await db
    .select()
    .from(paymentDisputes)
    .where(eq(paymentDisputes.stripeDisputeId, dispute.id))
    .limit(1);
  const eventAt = eventDate(stripeEventCreated);
  if (
    existing?.stripeEventCreatedAt &&
    existing.stripeEventCreatedAt > eventAt
  ) {
    return;
  }

  const closed = ["won", "lost", "prevented", "warning_closed"].includes(
    dispute.status,
  );
  const values = {
    status: dispute.status,
    reason: dispute.reason,
    evidenceDueBy: dispute.evidence_details.due_by
      ? eventDate(dispute.evidence_details.due_by)
      : null,
    closedAt: closed ? eventAt : null,
    stripeEventCreatedAt: eventAt,
    updatedAt: new Date(),
  };

  let disputeRowId = existing?.id;
  if (existing) {
    await db
      .update(paymentDisputes)
      .set(values)
      .where(eq(paymentDisputes.id, existing.id));
  } else {
    const [created] = await db
      .insert(paymentDisputes)
      .values({
        orgId: payment.orgId,
        paymentId: payment.id,
        stripeDisputeId: dispute.id,
        amount: fromCents(dispute.amount),
        openedAt: eventDate(dispute.created),
        ...values,
      })
      .returning({ id: paymentDisputes.id });
    disputeRowId = created.id;
  }

  if (dispute.status === "lost") {
    const reversalPaymentId = await ensureReversal({
      payment,
      amountCents: dispute.amount,
      kind: "chargeback_reversal",
      adjustmentId: dispute.id,
      note: "Card payment reversed after dispute",
    });
    await db
      .update(paymentDisputes)
      .set({ reversalPaymentId, updatedAt: new Date() })
      .where(eq(paymentDisputes.id, disputeRowId!));
  }
}