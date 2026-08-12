import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { fromCents } from "@/lib/billing";
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const orgId = session.metadata?.orgId;
  const residentId = session.metadata?.residentId;
  const cents = session.amount_total;
  if (!orgId || !residentId || !cents) {
    return NextResponse.json({ received: true });
  }

  // Unique stripe_session_id makes a redelivered event a no-op.
  await db
    .insert(payments)
    .values({
      orgId,
      residentId,
      amount: fromCents(cents),
      receivedOn: todayIso(),
      method: "card",
      payerName: session.metadata?.payerName || null,
      reference: typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripeSessionId: session.id,
    })
    .onConflictDoNothing();

  return NextResponse.json({ received: true });
}
