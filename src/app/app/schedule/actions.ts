"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  beds,
  houseEvents,
  residents,
  scheduleItems,
  type EventType,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { notifyResident } from "@/lib/push";
import { fmtDateLabel, fmtTime, isValidTime, todayIso } from "@/lib/schedule";

const EVENT_TYPES: EventType[] = [
  "house_meeting",
  "recovery_support",
  "life_skills",
  "chore_day",
  "outing",
  "other",
];

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function eventType(formData: FormData): EventType {
  const value = field(formData, "type") as EventType;
  return EVENT_TYPES.includes(value) ? value : "other";
}

function refresh() {
  revalidatePath("/app/schedule");
  revalidatePath("/me/schedule");
  revalidatePath("/me");
}

/**
 * Resolves the house a form is targeting. Returns undefined for an org-wide
 * item, or null when the user has no business touching that house.
 */
function resolveHouseId(
  raw: string,
  access: Access,
): string | null | undefined {
  if (!raw) {
    // Only admins may create items that span every house.
    return access.isAdmin ? undefined : null;
  }
  if (access.houseIds && !access.houseIds.includes(raw)) return null;
  return raw;
}

/** Active residents affected by a change, via their bed's house. */
async function activeResidentIds(orgId: string, houseId: string | null) {
  const rows = await db
    .select({ id: residents.id })
    .from(residents)
    .leftJoin(beds, eq(beds.id, residents.bedId))
    .where(
      houseId
        ? and(
            eq(residents.orgId, orgId),
            eq(residents.status, "active"),
            eq(beds.houseId, houseId),
          )
        : and(eq(residents.orgId, orgId), eq(residents.status, "active")),
    );
  return rows.map((r) => r.id);
}

export async function createScheduleItem(formData: FormData) {
  const access = await getAccess();

  const title = field(formData, "title");
  const startTime = field(formData, "startTime");
  const dayOfWeek = Number(field(formData, "dayOfWeek"));
  if (!title || !isValidTime(startTime)) return;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return;

  const endTime = field(formData, "endTime");
  if (endTime && !isValidTime(endTime)) return;

  const houseId = resolveHouseId(field(formData, "houseId"), access);
  if (houseId === null) return;

  await db.insert(scheduleItems).values({
    orgId: access.orgId,
    houseId: houseId ?? null,
    type: eventType(formData),
    title,
    description: field(formData, "description") || null,
    dayOfWeek,
    startTime,
    endTime: endTime || null,
    location: field(formData, "location") || null,
    mandatory: formData.get("mandatory") === "on",
    createdBy: access.profile.id,
  });

  refresh();
}

export async function toggleScheduleItem(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  if (!id) return;

  const [item] = await db
    .select({ id: scheduleItems.id, active: scheduleItems.active })
    .from(scheduleItems)
    .where(and(eq(scheduleItems.id, id), eq(scheduleItems.orgId, access.orgId)))
    .limit(1);
  if (!item) return;

  await db
    .update(scheduleItems)
    .set({ active: !item.active })
    .where(eq(scheduleItems.id, id));

  refresh();
}

export async function deleteScheduleItem(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  if (!id) return;

  await db
    .delete(scheduleItems)
    .where(and(eq(scheduleItems.id, id), eq(scheduleItems.orgId, access.orgId)));

  refresh();
}

export async function createHouseEvent(formData: FormData) {
  const access = await getAccess();

  const title = field(formData, "title");
  const eventDate = field(formData, "eventDate");
  const startTime = field(formData, "startTime");
  if (!title || !startTime || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return;
  if (!isValidTime(startTime)) return;

  const endTime = field(formData, "endTime");
  if (endTime && !isValidTime(endTime)) return;

  const houseId = resolveHouseId(field(formData, "houseId"), access);
  if (houseId === null) return;

  const [row] = await db
    .insert(houseEvents)
    .values({
      orgId: access.orgId,
      houseId: houseId ?? null,
      type: eventType(formData),
      title,
      description: field(formData, "description") || null,
      eventDate,
      startTime,
      endTime: endTime || null,
      location: field(formData, "location") || null,
      mandatory: formData.get("mandatory") === "on",
      createdBy: access.profile.id,
    })
    .returning({ id: houseEvents.id });

  if (row && formData.get("notify") === "on") {
    await notifyEvent(access, houseId ?? null, {
      title: "Added to the calendar",
      body: `${title} — ${fmtDateLabel(eventDate, todayIso())} at ${fmtTime(startTime)}.`,
    });
  }

  refresh();
}

export async function cancelHouseEvent(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  if (!id) return;

  const [event] = await db
    .select({
      id: houseEvents.id,
      houseId: houseEvents.houseId,
      title: houseEvents.title,
      eventDate: houseEvents.eventDate,
      cancelledAt: houseEvents.cancelledAt,
    })
    .from(houseEvents)
    .where(and(eq(houseEvents.id, id), eq(houseEvents.orgId, access.orgId)))
    .limit(1);
  if (!event) return;
  if (access.houseIds && event.houseId && !access.houseIds.includes(event.houseId)) {
    return;
  }

  const cancelling = !event.cancelledAt;
  await db
    .update(houseEvents)
    .set({ cancelledAt: cancelling ? new Date() : null })
    .where(eq(houseEvents.id, id));

  if (cancelling) {
    await notifyEvent(access, event.houseId, {
      title: "Cancelled",
      body: `${event.title} on ${fmtDateLabel(event.eventDate, todayIso())} is cancelled.`,
    });
  }

  refresh();
}

export async function deleteHouseEvent(formData: FormData) {
  const access = await getAccess();
  const id = field(formData, "id");
  if (!id) return;

  await db
    .delete(houseEvents)
    .where(and(eq(houseEvents.id, id), eq(houseEvents.orgId, access.orgId)));

  refresh();
}

/** Notifies the active residents a calendar change actually affects. */
async function notifyEvent(
  access: Access,
  houseId: string | null,
  message: { title: string; body: string },
) {
  const targets = await activeResidentIds(access.orgId, houseId);
  for (const residentId of targets) {
    await notifyResident({
      orgId: access.orgId,
      residentId,
      title: message.title,
      body: message.body,
      url: "/me/schedule",
      sentBy: access.profile.id,
    });
  }
}
