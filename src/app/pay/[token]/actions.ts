"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { organizations, paymentLinks } from "@/db/schema";
import { parseAmount } from "@/lib/billing";
import { currentOrigin } from "@/lib/payment-links";
import { requireStripe } from "@/lib/stripe";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Public, token-authenticated. Creates a Stripe Checkout Session and sends the
 * payer to it. Nothing is written to the ledger here — the webhook is the only
 * thing that decides a payment happened.
 */
export async function startCheckout(formData: FormData) {
  const token = field(formData, "token");
  if (!token) return;

  const [link] = await db
    .select({
      id: paymentLinks.id,
      orgId: paymentLinks.orgId,
      residentId: paymentLinks.residentId,
      amount: paymentLinks.amount,
      label: paymentLinks.label,
      thirdParty: paymentLinks.thirdParty,
      orgName: organizations.name,
    })
    .from(paymentLinks)
    .innerJoin(organizations, eq(paymentLinks.orgId, organizations.id))
    .where(
      and(
        eq(paymentLinks.token, token),
        isNull(paymentLinks.revokedAt),
        or(isNull(paymentLinks.expiresAt), gt(paymentLinks.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!link) return;

  // A fixed-amount link ignores anything the payer types.
  const cents = link.amount
    ? parseAmount(link.amount)
    : parseAmount(field(formData, "amount"));
  if (!cents || cents < 100) return;

  const payerName = field(formData, "payerName").slice(0, 120);
  if (link.thirdParty && !payerName) return;

  const origin = await currentOrigin();
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: { name: `Rent — ${link.label}` },
        },
      },
    ],
    // The webhook trusts these and nothing the browser sends.
    metadata: {
      orgId: link.orgId,
      residentId: link.residentId,
      linkId: link.id,
      payerName,
    },
    success_url: `${origin}/pay/${token}?paid=1`,
    cancel_url: `${origin}/pay/${token}`,
  });

  if (!session.url) return;
  redirect(session.url);
}
