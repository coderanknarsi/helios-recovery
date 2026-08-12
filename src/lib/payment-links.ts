import "server-only";

import { headers } from "next/headers";
import { siteConfig } from "@/lib/site";

/**
 * What a payer sees in the URL and on the page. Initials only — a link that
 * spells out who lives in a recovery residence is a disclosure, and the person
 * forwarding it to a caseworker has not agreed to make one.
 */
export function defaultLinkLabel(
  firstName: string,
  lastName: string,
  residentId: string,
) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return `${initials} ${residentId.slice(0, 4).toUpperCase()}`;
}

/** Absolute origin of the current request, so Stripe redirects work locally too. */
export async function currentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return siteConfig.url;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
