"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  residents,
  beds,
  houses,
  residentExits,
  residentLogs,
  type ExitParticipation,
  type ExitReason,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { notifyResident } from "@/lib/push";
import { revokeAllResidentSessions } from "@/lib/resident-auth";
import { siteConfig } from "@/lib/site";
import { sendSms } from "@/lib/sms";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const LOG_TYPES = [
  "note",
  "drug_test",
  "infraction",
  "pass",
  "chore",
  "medication",
] as const;
const RESULTS = ["pass", "fail", "refused", "pending"] as const;

const EXIT_REASONS: ExitReason[] = [
  "completed_program",
  "planned_transfer",
  "left_early",
  "rule_violation",
  "substance_use",
  "overdose",
  "arrest_incarceration",
  "medical_behavioral",
  "death",
  "other",
];

const EXIT_PARTICIPATION: ExitParticipation[] = [
  "none",
  "low",
  "moderate",
  "high",
];

type LogType = (typeof LOG_TYPES)[number];
type Result = (typeof RESULTS)[number];

/**
 * Returns the resident when it belongs to the org AND the current user is
 * allowed to manage it (admins: any; managers: only residents placed in one
 * of their assigned houses).
 */
async function scopedResident(residentId: string, access: Access) {
  const [row] = await db
    .select({
      id: residents.id,
      bedId: residents.bedId,
      houseId: beds.houseId,
    })
    .from(residents)
    .leftJoin(beds, eq(residents.bedId, beds.id))
    .where(and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)))
    .limit(1);
  if (!row) return null;
  if (access.isAdmin) return row;
  if (row.houseId && (access.houseIds ?? []).includes(row.houseId)) return row;
  return null;
}

function refresh(residentId: string) {
  revalidatePath(`/app/residents/${residentId}`);
  revalidatePath("/app/residents");
  revalidatePath("/app/property");
  revalidatePath("/app");
}

export async function addLog(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const type = field(formData, "type") as LogType;
  if (!residentId || !LOG_TYPES.includes(type)) return;
  if (!(await scopedResident(residentId, access))) return;

  const rawResult = field(formData, "result") as Result;
  const result =
    type === "drug_test" && RESULTS.includes(rawResult) ? rawResult : null;
  const occurredAt = field(formData, "occurredAt") || today();

  await db.insert(residentLogs).values({
    orgId: access.orgId,
    residentId,
    type,
    occurredAt,
    title: field(formData, "title") || null,
    detail: field(formData, "detail") || null,
    result,
    visibleToResident: formData.get("visibleToResident") === "on",
    createdBy: access.profile.id,
  });

  refresh(residentId);
}

/**
 * Texts the resident a link to the install walkthrough. This is the only
 * onboarding moment that costs an SMS, so it is a deliberate button rather
 * than something that fires automatically.
 */
export async function sendPortalInvite(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  const [r] = await db
    .select({ firstName: residents.firstName, phone: residents.phone })
    .from(residents)
    .where(
      and(eq(residents.id, residentId), eq(residents.orgId, access.orgId)),
    )
    .limit(1);
  if (!r?.phone) return;

  await sendSms({
    to: r.phone,
    text: `Hi ${r.firstName}, here's the ${siteConfig.shortName} resident app - your documents, house rules and support in one place: ${siteConfig.url}/install`,
  });

  refresh(residentId);
}

/**
 * Sends a message to a resident's portal and pushes a notification to their
 * devices. Delivery is best-effort; the message is stored either way.
 */
export async function sendResidentMessage(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const body = field(formData, "body");
  if (!residentId || !body) return;
  if (!(await scopedResident(residentId, access))) return;

  await notifyResident({
    orgId: access.orgId,
    residentId,
    title: field(formData, "title") || "Message from your house team",
    body,
    url: "/me",
    sentBy: access.profile.id,
  });

  revalidatePath("/me");
  refresh(residentId);
}

/** Show or hide a single log entry in the resident's portal. */
export async function toggleLogVisibility(formData: FormData) {
  const access = await getAccess();
  const logId = field(formData, "logId");
  const residentId = field(formData, "residentId");
  if (!logId || !residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  const [log] = await db
    .select({ visibleToResident: residentLogs.visibleToResident })
    .from(residentLogs)
    .where(
      and(
        eq(residentLogs.id, logId),
        eq(residentLogs.residentId, residentId),
        eq(residentLogs.orgId, access.orgId),
      ),
    )
    .limit(1);
  if (!log) return;

  await db
    .update(residentLogs)
    .set({ visibleToResident: !log.visibleToResident })
    .where(eq(residentLogs.id, logId));

  refresh(residentId);
  revalidatePath("/me");
}

/** Sign the resident out of the portal on every device. */
export async function revokePortalAccess(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  await revokeAllResidentSessions(residentId);
  refresh(residentId);
}

export async function deleteLog(formData: FormData) {
  const access = await getAccess();
  const logId = field(formData, "logId");
  const residentId = field(formData, "residentId");
  if (!logId || !residentId) return;
  if (!(await scopedResident(residentId, access))) return;

  await db
    .delete(residentLogs)
    .where(
      and(
        eq(residentLogs.id, logId),
        eq(residentLogs.residentId, residentId),
        eq(residentLogs.orgId, access.orgId),
      ),
    );

  refresh(residentId);
}

/** Assign or move a resident to a bed, freeing any previous bed. */
export async function assignBed(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  const bedId = field(formData, "bedId");
  if (!residentId || !bedId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;

  // The target bed must belong to the org (and, for managers, to one of
  // their assigned houses) and be free.
  const [bed] = await db
    .select({ id: beds.id, status: beds.status, houseId: beds.houseId })
    .from(beds)
    .innerJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(beds.id, bedId), eq(houses.orgId, access.orgId)))
    .limit(1);
  if (!bed) return;
  if (
    !access.isAdmin &&
    !(access.houseIds ?? []).includes(bed.houseId)
  )
    return;
  if (bed.status === "occupied" || bed.status === "reserved") return;

  // Free the resident's previous bed, if any.
  if (resident.bedId && resident.bedId !== bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(eq(beds.id, resident.bedId));
  }

  await db.update(beds).set({ status: "occupied" }).where(eq(beds.id, bedId));
  await db
    .update(residents)
    .set({ bedId, updatedAt: new Date() })
    .where(eq(residents.id, residentId));

  refresh(residentId);
}

export async function dischargeResident(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;

  // How someone left is the point of the record, so it is required.
  const reason = field(formData, "reason") as ExitReason;
  if (!EXIT_REASONS.includes(reason)) return;

  const rawParticipation = field(formData, "participation") as ExitParticipation;
  const participation = EXIT_PARTICIPATION.includes(rawParticipation)
    ? rawParticipation
    : null;

  const exitDate = field(formData, "exitDate") || today();

  if (resident.bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(eq(beds.id, resident.bedId));
  }

  await db.insert(residentExits).values({
    orgId: access.orgId,
    residentId,
    exitDate,
    planned: formData.get("planned") === "on",
    reason,
    reasonDetail: field(formData, "reasonDetail") || null,
    participation,
    progressSummary: field(formData, "progressSummary") || null,
    residentStatement: field(formData, "residentStatement") || null,
    ongoingRecoveryPlan: field(formData, "ongoingRecoveryPlan") || null,
    referrals: field(formData, "referrals") || null,
    forwardingAddress: field(formData, "forwardingAddress") || null,
    forwardingPhone: field(formData, "forwardingPhone") || null,
    forwardingEmail: field(formData, "forwardingEmail") || null,
    recordedBy: access.profile.id,
  });

  await db
    .update(residents)
    .set({
      status: "discharged",
      dischargeDate: exitDate,
      bedId: null,
      updatedAt: new Date(),
    })
    .where(eq(residents.id, residentId));

  // Discharge immediately ends any resident portal access.
  await revokeAllResidentSessions(residentId);

  refresh(residentId);
}

/** Set or clear the optional expected move-out estimate for a resident. */
export async function setExpectedDeparture(formData: FormData) {
  const access = await getAccess();
  const residentId = field(formData, "residentId");
  if (!residentId) return;

  const resident = await scopedResident(residentId, access);
  if (!resident) return;

  const raw = field(formData, "expectedDepartureDate");
  const value = raw.length ? raw : null;

  await db
    .update(residents)
    .set({ expectedDepartureDate: value, updatedAt: new Date() })
    .where(eq(residents.id, residentId));

  refresh(residentId);
  revalidatePath("/app/availability");
}
