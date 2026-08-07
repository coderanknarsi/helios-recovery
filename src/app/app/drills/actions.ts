"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  beds,
  houses,
  residents,
  safetyDrillAttendees,
  safetyDrills,
  type DrillAttendance,
  type DrillType,
} from "@/db/schema";
import { getAccess, type Access } from "@/lib/access";
import { DRILL_TYPE_VALUES } from "@/lib/drills";
import { todayIso } from "@/lib/schedule";

const ATTENDANCE: DrillAttendance[] = ["present", "absent", "briefed_later"];

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function canTouchHouse(access: Access, houseId: string) {
  if (!access.isAdmin && !(access.houseIds ?? []).includes(houseId)) {
    return false;
  }
  const [row] = await db
    .select({ id: houses.id })
    .from(houses)
    .where(and(eq(houses.id, houseId), eq(houses.orgId, access.orgId)))
    .limit(1);
  return !!row;
}

/**
 * Logs one drill plus who took part. The roster is re-read from the house here
 * rather than trusted from the form, so a tampered payload cannot attach a
 * resident from another house to the record.
 */
export async function logDrill(formData: FormData) {
  const access = await getAccess();
  const houseId = field(formData, "houseId");
  if (!houseId || !(await canTouchHouse(access, houseId))) return;

  const rawType = field(formData, "type");
  if (!DRILL_TYPE_VALUES.includes(rawType as DrillType)) return;
  const type = rawType as DrillType;

  const conductedOn = field(formData, "conductedOn") || todayIso();

  const rawSeconds = Number(field(formData, "evacuationSeconds"));
  const evacuationSeconds =
    Number.isFinite(rawSeconds) && rawSeconds > 0
      ? Math.round(rawSeconds)
      : null;

  const roster = await db
    .select({ id: residents.id })
    .from(residents)
    .innerJoin(beds, eq(residents.bedId, beds.id))
    .where(
      and(
        eq(residents.orgId, access.orgId),
        eq(residents.status, "active"),
        eq(beds.houseId, houseId),
      ),
    );

  const [drill] = await db
    .insert(safetyDrills)
    .values({
      orgId: access.orgId,
      houseId,
      type,
      conductedOn,
      evacuationSeconds,
      notes: field(formData, "notes") || null,
      conductedBy: access.profile.id,
    })
    .returning({ id: safetyDrills.id });

  const attendees = roster.map((r) => {
    const raw = field(formData, `status_${r.id}`);
    const status = ATTENDANCE.includes(raw as DrillAttendance)
      ? (raw as DrillAttendance)
      : "present";
    return {
      orgId: access.orgId,
      drillId: drill.id,
      residentId: r.id,
      status,
    };
  });

  if (attendees.length) {
    await db.insert(safetyDrillAttendees).values(attendees);
  }

  revalidatePath("/app/drills");
  revalidatePath("/app/today");
}
