import "server-only";

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

export const stripeEnabled = !!key;

/**
 * Null until STRIPE_SECRET_KEY is set, so the app still builds and runs for
 * anyone who has not configured payments.
 */
export const stripe = key ? new Stripe(key) : null;

export function requireStripe(): Stripe {
  if (!stripe) throw new Error("STRIPE_SECRET_KEY is not set.");
  return stripe;
}
