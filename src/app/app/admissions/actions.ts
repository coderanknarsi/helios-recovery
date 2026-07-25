"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { residents, beds } from "@/db/schema";
import { getCurrentProfile } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Convert a prospect into an active resident, optionally assigning a bed. */
export async function acceptProspect(formData: FormData) {
  const profile = await getCurrentProfile();
  const id = String(formData.get("id") ?? "");
  const rawBed = String(formData.get("bedId") ?? "");
  const bedId = rawBed.length ? rawBed : null;
  if (!id) return;

  await db
    .update(residents)
    .set({
      status: "active",
      admitDate: today(),
      bedId,
      updatedAt: new Date(),
    })
    .where(and(eq(residents.id, id), eq(residents.orgId, profile.orgId!)));

  if (bedId) {
    await db
      .update(beds)
      .set({ status: "occupied" })
      .where(eq(beds.id, bedId));
  }

  revalidatePath("/app/admissions");
  revalidatePath("/app");
}

/** Reserve a bed for an incoming prospect ("Hold a Bed"). */
export async function holdBed(formData: FormData) {
  const profile = await getCurrentProfile();
  const id = String(formData.get("id") ?? "");
  const bedId = String(formData.get("bedId") ?? "");
  if (!id || !bedId) return;

  await db
    .update(residents)
    .set({ bedId, updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, profile.orgId!)));

  await db.update(beds).set({ status: "reserved" }).where(eq(beds.id, bedId));

  revalidatePath("/app/admissions");
  revalidatePath("/app");
}

/** Decline a prospect's application. */
export async function rejectProspect(formData: FormData) {
  const profile = await getCurrentProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(residents)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, profile.orgId!)));

  revalidatePath("/app/admissions");
  revalidatePath("/app");
}
