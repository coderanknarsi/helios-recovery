import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { residentOtps, residentSessions, residents } from "@/db/schema";
import { sendSms, toE164 } from "@/lib/sms";

/** Cookie holding the raw resident session token. */
export const RESIDENT_SESSION_COOKIE = "helios_resident_session";

/** How long a texted code stays valid. */
const OTP_TTL_MINUTES = 10;
/** Wrong guesses allowed against a single code before it is burned. */
const MAX_VERIFY_ATTEMPTS = 5;
/** Codes a single phone number may request inside SEND_WINDOW_MINUTES. */
const MAX_SENDS_PER_PHONE = 3;
const SEND_WINDOW_MINUTES = 15;
/** Codes a single IP may request inside IP_WINDOW_MINUTES. */
const MAX_SENDS_PER_IP = 10;
const IP_WINDOW_MINUTES = 60;
/** Sliding lifetime of an authenticated session. */
export const SESSION_TTL_DAYS = 30;

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

function pepper() {
  const secret = process.env.RESIDENT_AUTH_SECRET;
  if (!secret) {
    throw new Error("RESIDENT_AUTH_SECRET is not set.");
  }
  return secret;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Hash a passcode, bound to the resident so codes are not interchangeable. */
function hashCode(residentId: string, code: string) {
  return sha256(`${pepper()}:${residentId}:${code}`);
}

/** Hash a session token. Only this value is ever stored. */
export function hashSessionToken(token: string) {
  return sha256(`${pepper()}:session:${token}`);
}

/** Timing-safe comparison of two hex digests. */
function digestsMatch(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/** Cryptographically random 6-digit passcode, zero-padded. */
function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type RequestCodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid_phone" | "rate_limited" | "send_failed" };

/**
 * Look up an active resident by phone number and text them a fresh passcode.
 *
 * Callers must NOT surface the difference between "no such resident" and
 * "code sent" — this returns `ok: true` in both cases so the endpoint cannot
 * be used to enumerate which phone numbers belong to residents.
 */
export async function requestResidentCode({
  phone,
  ip,
}: {
  phone: string;
  ip: string | null;
}): Promise<RequestCodeResult> {
  const e164 = toE164(phone);
  if (!e164) return { ok: false, reason: "invalid_phone" };

  // Per-IP throttle first, so an attacker cannot cycle through numbers.
  if (ip) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(residentOtps)
      .where(
        and(
          eq(residentOtps.requestIp, ip),
          gte(residentOtps.createdAt, minutesAgo(IP_WINDOW_MINUTES)),
        ),
      );
    if ((row?.n ?? 0) >= MAX_SENDS_PER_IP) {
      return { ok: false, reason: "rate_limited" };
    }
  }

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(residentOtps)
    .where(
      and(
        eq(residentOtps.phone, e164),
        gte(residentOtps.createdAt, minutesAgo(SEND_WINDOW_MINUTES)),
      ),
    );
  if ((row?.n ?? 0) >= MAX_SENDS_PER_PHONE) {
    return { ok: false, reason: "rate_limited" };
  }

  // Only current residents get portal access. Prospects still use the
  // one-off /sign/[token] links issued during admissions.
  const candidates = await db
    .select({
      id: residents.id,
      orgId: residents.orgId,
      phone: residents.phone,
      firstName: residents.firstName,
    })
    .from(residents)
    .where(eq(residents.status, "active"));

  const resident = candidates.find((r) => toE164(r.phone) === e164);
  if (!resident) {
    // Deliberately indistinguishable from success.
    return { ok: true };
  }

  const code = generateCode();

  // Retire any outstanding codes for this resident so only the newest works.
  await db
    .update(residentOtps)
    .set({ consumedAt: new Date() })
    .where(
      and(eq(residentOtps.residentId, resident.id), isNull(residentOtps.consumedAt)),
    );

  await db.insert(residentOtps).values({
    orgId: resident.orgId,
    residentId: resident.id,
    phone: e164,
    codeHash: hashCode(resident.id, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    requestIp: ip,
  });

  try {
    await sendSms({
      to: e164,
      text: `${code} is your Helios Recovery sign-in code. It expires in ${OTP_TTL_MINUTES} minutes. Never share this code.`,
    });
  } catch (error) {
    console.error("Failed to send resident sign-in code", error);
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true };
}

export type VerifyCodeResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid_phone" | "invalid_code" };

/**
 * Check a passcode and, on success, mint a session token. The caller is
 * responsible for writing the returned token to the session cookie.
 */
export async function verifyResidentCode({
  phone,
  code,
  ip,
  userAgent,
}: {
  phone: string;
  code: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<VerifyCodeResult> {
  const e164 = toE164(phone);
  if (!e164) return { ok: false, reason: "invalid_phone" };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: "invalid_code" };

  const [otp] = await db
    .select()
    .from(residentOtps)
    .where(and(eq(residentOtps.phone, e164), isNull(residentOtps.consumedAt)))
    .orderBy(desc(residentOtps.createdAt))
    .limit(1);

  if (!otp) return { ok: false, reason: "invalid_code" };
  if (otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "invalid_code" };
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    await db
      .update(residentOtps)
      .set({ consumedAt: new Date() })
      .where(eq(residentOtps.id, otp.id));
    return { ok: false, reason: "invalid_code" };
  }

  if (!digestsMatch(otp.codeHash, hashCode(otp.residentId, code))) {
    await db
      .update(residentOtps)
      .set({ attempts: otp.attempts + 1 })
      .where(eq(residentOtps.id, otp.id));
    return { ok: false, reason: "invalid_code" };
  }

  // Re-check status at redemption time in case the resident was discharged
  // between requesting and entering the code.
  const [resident] = await db
    .select({ id: residents.id, orgId: residents.orgId, status: residents.status })
    .from(residents)
    .where(eq(residents.id, otp.residentId))
    .limit(1);

  await db
    .update(residentOtps)
    .set({ consumedAt: new Date() })
    .where(eq(residentOtps.id, otp.id));

  if (!resident || resident.status !== "active") {
    return { ok: false, reason: "invalid_code" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await db.insert(residentSessions).values({
    orgId: resident.orgId,
    residentId: resident.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent,
    ip,
  });

  return { ok: true, token, expiresAt };
}

/** Revoke a single session (sign out). */
export async function revokeResidentSession(token: string) {
  await db
    .update(residentSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(residentSessions.tokenHash, hashSessionToken(token)),
        isNull(residentSessions.revokedAt),
      ),
    );
}

/** Revoke every session for a resident — used on discharge or removal. */
export async function revokeAllResidentSessions(residentId: string) {
  await db
    .update(residentSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(residentSessions.residentId, residentId),
        isNull(residentSessions.revokedAt),
      ),
    );
}
