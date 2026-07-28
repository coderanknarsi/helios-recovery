import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  beds,
  houses,
  organizations,
  residents,
  residentSessions,
  rooms,
} from "@/db/schema";
import {
  RESIDENT_SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "@/lib/resident-session";
import { hashSessionToken } from "@/lib/resident-auth";

export type ResidentAccess = {
  sessionId: string;
  residentId: string;
  orgId: string;
  orgName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  admitDate: string | null;
  sobrietyDate: string | null;
  houseId: string | null;
  houseName: string | null;
  housePhone: string | null;
  houseAddressLine1: string | null;
  houseCity: string | null;
  houseState: string | null;
  housePostalCode: string | null;
  roomName: string | null;
  bedLabel: string | null;
};

/**
 * Resolve the signed-in resident from the session cookie, or null.
 *
 * Never trust a resident id supplied by the client — every resident-facing
 * query must be scoped by the id returned here.
 */
export async function getResidentSession(): Promise<ResidentAccess | null> {
  const store = await cookies();
  const token = store.get(RESIDENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: residentSessions.id,
      residentId: residents.id,
      orgId: residents.orgId,
      orgName: organizations.name,
      firstName: residents.firstName,
      lastName: residents.lastName,
      phone: residents.phone,
      email: residents.email,
      admitDate: residents.admitDate,
      sobrietyDate: residents.sobrietyDate,
      status: residents.status,
      houseId: houses.id,
      houseName: houses.name,
      housePhone: houses.phone,
      houseAddressLine1: houses.addressLine1,
      houseCity: houses.city,
      houseState: houses.state,
      housePostalCode: houses.postalCode,
      roomName: rooms.name,
      bedLabel: beds.label,
    })
    .from(residentSessions)
    .innerJoin(residents, eq(residentSessions.residentId, residents.id))
    .innerJoin(organizations, eq(residents.orgId, organizations.id))
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .leftJoin(rooms, eq(beds.roomId, rooms.id))
    .leftJoin(houses, eq(beds.houseId, houses.id))
    .where(
      and(
        eq(residentSessions.tokenHash, hashSessionToken(token)),
        isNull(residentSessions.revokedAt),
        gt(residentSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;
  // A discharged resident's session is dead even if it has not expired.
  if (row.status !== "active") return null;

  const { status: _status, ...access } = row;
  return access;
}

/** Require a signed-in resident, or send them to the portal login. */
export async function requireResident(): Promise<ResidentAccess> {
  const access = await getResidentSession();
  if (!access) redirect("/me/login");
  return access;
}

/**
 * Extend a session's lifetime. Called from the portal layout so an active
 * resident is not signed out every 30 days.
 */
export async function touchResidentSession(sessionId: string) {
  await db
    .update(residentSessions)
    .set({
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
    })
    .where(eq(residentSessions.id, sessionId));
}
