import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { paymentLinks, payments } from "@/db/schema";
import { fromCents } from "@/lib/billing";
import {
  reconcileDispute,
  reconcileRefund,
} from "@/lib/payment-adjustments";
import { todayIso } from "@/lib/schedule";
import { stripe } from "@/lib/stripe";

/**
 * The redirect back from Stripe is a courtesy; this is the truth. Signature
 * verification needs the raw body, so nothing may parse it first.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.payment_status !== "paid") break;

        const orgId = session.metadata?.orgId;
        const residentId = session.metadata?.residentId;
        const cents = session.amount_total;
        if (!orgId || !residentId || !cents) break;

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        const stripeChargeId =
          session.payment_intent &&
          typeof session.payment_intent !== "string" &&
          session.payment_intent.latest_charge
            ? typeof session.payment_intent.latest_charge === "string"
              ? session.payment_intent.latest_charge
              : session.payment_intent.latest_charge.id
            : null;

        // Unique Stripe IDs make a redelivered event a no-op.
        await db
          .insert(payments)
          .values({
            orgId,
            residentId,
            amount: fromCents(cents),
            receivedOn: todayIso(),
            method: "card",
            payerName: session.metadata?.payerName || null,
            reference: paymentIntentId,
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            stripeChargeId,
          })
          .onConflictDoNothing();

        // Retire the link so it cannot be paid a second time.
        const linkId = session.metadata?.linkId;
        if (linkId) {
          await db
            .update(paymentLinks)
            .set({ paidAt: new Date() })
            .where(
              and(
                eq(paymentLinks.id, linkId),
                eq(paymentLinks.orgId, orgId),
                isNull(paymentLinks.paidAt),
              ),
            );
        }
        break;
      }
      case "refund.created":
      case "refund.updated":
      case "refund.failed":
        await reconcileRefund(event.data.object, event.created);
        break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
        await reconcileDispute(event.data.object, event.created);
        break;
    }
  } catch (error) {
    console.error(`[stripe] could not reconcile ${event.type}`, error);
    return NextResponse.json(
      { error: "Stripe event could not be reconciled." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
