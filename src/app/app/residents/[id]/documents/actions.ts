"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  residents,
  beds,
  rooms,
  houses,
  organizations,
  intakeDocuments,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { buildIntakePacket, type DocContext } from "@/lib/intake-templates";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fmtDate(value: string | Date | null) {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const periodAbbrev: Record<string, string> = {
  daily: "day",
  weekly: "wk",
  biweekly: "2wk",
  monthly: "mo",
};

function fmtRent(amount: string | null, period: string | null) {
  if (!amount) return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const money = n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${money} / ${periodAbbrev[period ?? "monthly"] ?? "mo"}`;
}

/**
 * Loads a resident with their bed/house/rate context, enforcing that the
 * current user is allowed to manage them (admins: any; managers: assigned
 * houses only).
 */
async function scopedResidentContext(residentId: string, access: Access) {
  const [row] = await db
    .select({
      id: residents.id,
      firstName: residents.firstName,
      lastName: residents.lastName,
      dateOfBirth: residents.dateOfBirth,
      email: residents.email,
      phone: residents.phone,
      emergencyContactName: residents.emergencyContactName,
      emergencyContactPhone: residents.emergencyContactPhone,
      emergencyContactRelation: residents.emergencyContactRelation,
      desiredMoveInDate: residents.desiredMoveInDate,
      houseId: beds.houseId,
      bedLabel: beds.label,
      monthlyRate: beds.monthlyRate,
      ratePeriod: beds.ratePeriod,
      roomName: rooms.name,
      houseName: houses.name,
      houseAddress1: houses.addressLine1,
      houseCity: houses.city,
      houseState: houses.state,
    })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .leftJoin(rooms, eq(beds.roomId, rooms.id))
    .leftJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)))
    .limit(1);

  if (!row) return null;
  if (access.isAdmin) return row;
  if (row.houseId && (access.houseIds ?? []).includes(row.houseId)) return row;
  return null;
}

/** Generate the pre-filled intake packet for a resident (idempotent). */
export async function generateIntakePacket(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const r = await scopedResidentContext(residentId, access);
  if (!r) return;

  // Don't create duplicates if a packet already exists.
  const existing = await db
    .select({ id: intakeDocuments.id })
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, residentId),
        eq(intakeDocuments.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, access.orgId))
    .limit(1);

  const address = [r.houseAddress1, r.houseCity, r.houseState]
    .filter(Boolean)
    .join(", ");
  const emergency = [
    r.emergencyContactName,
    r.emergencyContactPhone,
    r.emergencyContactRelation ? `(${r.emergencyContactRelation})` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const ctx: DocContext = {
    orgName: org?.name ?? "Helios Recovery Residences",
    residentName: `${r.firstName} ${r.lastName}`.trim(),
    dateOfBirth: fmtDate(r.dateOfBirth),
    email: r.email ?? "",
    phone: r.phone ?? "",
    emergencyContact: emergency,
    houseName: r.houseName ?? "",
    houseAddress: address,
    bedLabel: r.bedLabel ?? "",
    roomName: r.roomName ?? "",
    rent: fmtRent(r.monthlyRate, r.ratePeriod),
    moveInDate: fmtDate(r.desiredMoveInDate),
    today: fmtDate(new Date()),
  };

  const templates = buildIntakePacket(ctx);
  await db.insert(intakeDocuments).values(
    templates.map((t) => ({
      orgId: access.orgId,
      residentId,
      type: t.type,
      title: t.title,
      body: t.body,
      createdBy: access.profile.id,
    })),
  );

  revalidatePath(`/app/residents/${residentId}`);
}

/** Record a typed e-signature on a single intake document. */
export async function signDocument(formData: FormData) {
  const access = await getAccess();
  const docId = field(formData, "docId");
  const residentId = field(formData, "residentId");
  const signedName = field(formData, "signedName");
  const agree = formData.get("agree");
  if (!docId || !residentId || !signedName) return;
  if (agree !== "on" && agree !== "true") return;

  // The resident must be in scope.
  if (!(await scopedResidentContext(residentId, access))) return;

  // The document must belong to this resident/org and be unsigned.
  const [doc] = await db
    .select({ id: intakeDocuments.id, status: intakeDocuments.status })
    .from(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.id, docId),
        eq(intakeDocuments.residentId, residentId),
        eq(intakeDocuments.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!doc || doc.status === "signed") return;

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;

  await db
    .update(intakeDocuments)
    .set({
      status: "signed",
      signedName,
      signedAt: new Date(),
      signedIp: ip,
    })
    .where(eq(intakeDocuments.id, docId));

  revalidatePath(`/app/residents/${residentId}`);
  revalidatePath(`/app/residents/${residentId}/documents/${docId}`);
}

/** Delete a resident's intake packet so it can be regenerated (admins only). */
export async function resetIntakePacket(formData: FormData) {
  const access = await getAccess();
  if (!access.isAdmin) return;
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  await db
    .delete(intakeDocuments)
    .where(
      and(
        eq(intakeDocuments.residentId, residentId),
        eq(intakeDocuments.orgId, access.orgId),
      ),
    );

  revalidatePath(`/app/residents/${residentId}`);
}
