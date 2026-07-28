/**
 * Resident session constants shared by the proxy (edge-safe), server actions,
 * and the auth library. Kept free of database/server-only imports so it can be
 * used from proxy.ts.
 */

/** Cookie holding the raw resident session token. */
export const RESIDENT_SESSION_COOKIE = "helios_resident_session";

/**
 * Sliding lifetime of an authenticated resident session.
 *
 * Deliberately long: every sign-in costs an SMS, so a resident who keeps using
 * the portal should never have to pay for another code. The real security
 * boundary is revocation (sign-out, discharge), not the clock.
 */
export const SESSION_TTL_DAYS = 180;

export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
