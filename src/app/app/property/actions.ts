"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { houses, rooms, beds } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseRate(raw: string): string | null {
  if (!raw) return null;
  return /^\d+(\.\d{1,2})?$/.test(raw) ? raw : null;
}

const PERIODS = ["daily", "weekly", "biweekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

function parsePeriod(raw: string, fallback: Period): Period {
  return (PERIODS as readonly string[]).includes(raw)
    ? (raw as Period)
    : fallback;
}

/** True when the house exists and belongs to the current org. */
async function houseInOrg(houseId: string, orgId: string) {
  const [row] = await db
    .select({ id: houses.id })
    .from(houses)
    .where(and(eq(houses.id, houseId), eq(houses.orgId, orgId)))
    .limit(1);
  return Boolean(row);
}

function refresh() {
  revalidatePath("/app/property");
  revalidatePath("/app");
}

export async function createHouse(formData: FormData) {
  const profile = await getCurrentProfile();
  const name = field(formData, "name");
  if (!name) return;

  await db.insert(houses).values({
    orgId: profile.orgId!,
    name,
    addressLine1: field(formData, "addressLine1") || null,
    city: field(formData, "city") || null,
    state: field(formData, "state") || null,
    postalCode: field(formData, "postalCode") || null,
    phone: field(formData, "phone") || null,
  });

  refresh();
}

export async function createRoom(formData: FormData) {
  const profile = await getCurrentProfile();
  const houseId = field(formData, "houseId");
  const name = field(formData, "name");
  if (!houseId || !name) return;
  if (!(await houseInOrg(houseId, profile.orgId!))) return;

  const floorRaw = field(formData, "floor");
  const floor = floorRaw ? Number.parseInt(floorRaw, 10) : null;

  await db.insert(rooms).values({
    houseId,
    name,
    floor: floor !== null && Number.isFinite(floor) ? floor : null,
  });

  refresh();
}

export async function createBeds(formData: FormData) {
  const profile = await getCurrentProfile();
  const houseId = field(formData, "houseId");
  const roomId = field(formData, "roomId");
  if (!houseId || !roomId) return;
  if (!(await houseInOrg(houseId, profile.orgId!))) return;

  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.houseId, houseId)))
    .limit(1);
  if (!room) return;

  const type = field(formData, "bedType") === "bunk" ? "bunk" : "single";
  const qtyRaw = Number.parseInt(field(formData, "quantity"), 10);
  const quantity = Number.isFinite(qtyRaw)
    ? Math.min(Math.max(qtyRaw, 1), 20)
    : 1;
  const base = field(formData, "label");
  const rate = parseRate(field(formData, "monthlyRate"));
  const ratePeriod = parsePeriod(field(formData, "ratePeriod"), "weekly");

  // Number new single beds after any that already exist in the room.
  const existing = await db
    .select({ id: beds.id })
    .from(beds)
    .where(eq(beds.roomId, roomId));
  let n = existing.length;

  const rows: {
    roomId: string;
    houseId: string;
    label: string;
    monthlyRate: string | null;
  }[] = [];

  if (type === "bunk") {
    // Each bunk creates two beds (top + bottom).
    for (let i = 0; i < quantity; i++) {
      const label =
        quantity > 1 ? `${base || "Bunk"} ${i + 1}` : base || "Bunk";
      rows.push(
        { roomId, houseId, label: `${label} (top)`, monthlyRate: rate },
        { roomId, houseId, label: `${label} (bottom)`, monthlyRate: rate },
      );
    }
  } else {
    for (let i = 0; i < quantity; i++) {
      n += 1;
      const label = quantity === 1 && base ? base : `${base || "Bed"} ${n}`;
      rows.push({ roomId, houseId, label, monthlyRate: rate });
    }
  }

  if (rows.length)
    await db.insert(beds).values(rows.map((r) => ({ ...r, ratePeriod })));

  refresh();
}

/** Edit a bed's label and/or monthly rate (allowed even while in use). */
export async function updateBed(formData: FormData) {
  const profile = await getCurrentProfile();
  const bedId = field(formData, "bedId");
  if (!bedId) return;

  const [bed] = await db
    .select({
      houseId: beds.houseId,
      label: beds.label,
      ratePeriod: beds.ratePeriod,
    })
    .from(beds)
    .where(eq(beds.id, bedId))
    .limit(1);
  if (!bed) return;
  if (!(await houseInOrg(bed.houseId, profile.orgId!))) return;

  const label = field(formData, "label") || bed.label;
  const monthlyRate = parseRate(field(formData, "monthlyRate"));
  const ratePeriod = parsePeriod(field(formData, "ratePeriod"), bed.ratePeriod);

  await db
    .update(beds)
    .set({ label, monthlyRate, ratePeriod })
    .where(eq(beds.id, bedId));
  refresh();
}

/** Toggle a bed between available and maintenance (never while in use). */
export async function setBedStatus(formData: FormData) {
  const profile = await getCurrentProfile();
  const bedId = field(formData, "bedId");
  const status = field(formData, "status");
  if (!bedId || (status !== "available" && status !== "maintenance")) return;

  const [bed] = await db
    .select({ houseId: beds.houseId, status: beds.status })
    .from(beds)
    .where(eq(beds.id, bedId))
    .limit(1);
  if (!bed) return;
  if (!(await houseInOrg(bed.houseId, profile.orgId!))) return;
  if (bed.status === "occupied" || bed.status === "reserved") return;

  await db.update(beds).set({ status }).where(eq(beds.id, bedId));
  refresh();
}

export async function deleteBed(formData: FormData) {
  const profile = await getCurrentProfile();
  const bedId = field(formData, "bedId");
  if (!bedId) return;

  const [bed] = await db
    .select({ houseId: beds.houseId, status: beds.status })
    .from(beds)
    .where(eq(beds.id, bedId))
    .limit(1);
  if (!bed) return;
  if (!(await houseInOrg(bed.houseId, profile.orgId!))) return;
  if (bed.status === "occupied" || bed.status === "reserved") return;

  await db.delete(beds).where(eq(beds.id, bedId));
  refresh();
}

export async function deleteRoom(formData: FormData) {
  const profile = await getCurrentProfile();
  const roomId = field(formData, "roomId");
  if (!roomId) return;

  const [room] = await db
    .select({ houseId: rooms.houseId })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);
  if (!room) return;
  if (!(await houseInOrg(room.houseId, profile.orgId!))) return;

  // Block deletion while any bed in the room is occupied or reserved.
  const busy = await db
    .select({ status: beds.status })
    .from(beds)
    .where(eq(beds.roomId, roomId));
  if (busy.some((b) => b.status === "occupied" || b.status === "reserved"))
    return;

  await db.delete(rooms).where(eq(rooms.id, roomId));
  refresh();
}

export async function deleteHouse(formData: FormData) {
  const profile = await getCurrentProfile();
  const houseId = field(formData, "houseId");
  if (!houseId) return;
  if (!(await houseInOrg(houseId, profile.orgId!))) return;

  const busy = await db
    .select({ id: beds.id, status: beds.status })
    .from(beds)
    .where(eq(beds.houseId, houseId));
  if (busy.some((b) => b.status === "occupied" || b.status === "reserved"))
    return;

  await db.delete(houses).where(eq(houses.id, houseId));
  refresh();
}
