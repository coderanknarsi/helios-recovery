"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { residents, beds, houses, organizations } from "@/db/schema";
import { adminOrgId } from "@/lib/access";
import { siteConfig } from "@/lib/site";
import { sendSms } from "@/lib/sms";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reset any bed that is still marked "reserved" but is no longer claimed by a
 * prospect or active resident back to "available". Self-heals stray holds so a
 * bed can never get stuck reserved forever.
 */
async function releaseOrphanedReservedBeds(orgId: string) {
  const claimed = await db
    .select({ bedId: residents.bedId })
    .from(residents)
    .where(
      and(
        eq(residents.orgId, orgId),
        isNotNull(residents.bedId),
        inArray(residents.status, ["prospect", "active"]),
      ),
    );
  const claimedIds = new Set(
    claimed.map((r) => r.bedId).filter((b): b is string => !!b),
  );

  const reserved = await db
    .select({ id: beds.id })
    .from(beds)
    .innerJoin(houses, eq(beds.houseId, houses.id))
    .where(and(eq(houses.orgId, orgId), eq(beds.status, "reserved")));

  const orphaned = reserved.map((b) => b.id).filter((id) => !claimedIds.has(id));
  if (orphaned.length) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(inArray(beds.id, orphaned));
  }
}

async function sendEmail(payload: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}

/** Convert a prospect into an active resident, optionally assigning a bed. */
export async function acceptProspect(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
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
      waitlistedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  if (bedId) {
    await db
      .update(beds)
      .set({ status: "occupied" })
      .where(eq(beds.id, bedId));
  }

  // Free any bed the prospect had on hold that we didn't just admit them into.
  await releaseOrphanedReservedBeds(orgId);

  revalidatePath("/app/admissions");
  revalidatePath("/app");
  revalidatePath("/app/availability");
}

/** Reserve a bed for an incoming prospect ("Hold a Bed"). */
export async function holdBed(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  const bedId = String(formData.get("bedId") ?? "");
  if (!id || !bedId) return;

  // Release any bed this prospect was already holding before moving the hold.
  const [current] = await db
    .select({ bedId: residents.bedId })
    .from(residents)
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);
  if (current?.bedId && current.bedId !== bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(and(eq(beds.id, current.bedId), eq(beds.status, "reserved")));
  }

  await db
    .update(residents)
    .set({ bedId, updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  await db.update(beds).set({ status: "reserved" }).where(eq(beds.id, bedId));

  // Clean up any strays left over from earlier repeated clicks.
  await releaseOrphanedReservedBeds(orgId);

  revalidatePath("/app/admissions");
  revalidatePath("/app");
  revalidatePath("/app/availability");
}

/** Release a bed a prospect was holding (returns it to available). */
export async function releaseHold(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [current] = await db
    .select({ bedId: residents.bedId })
    .from(residents)
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);

  await db
    .update(residents)
    .set({ bedId: null, updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  if (current?.bedId) {
    await db
      .update(beds)
      .set({ status: "available" })
      .where(and(eq(beds.id, current.bedId), eq(beds.status, "reserved")));
  }

  await releaseOrphanedReservedBeds(orgId);

  revalidatePath("/app/admissions");
  revalidatePath("/app");
  revalidatePath("/app/availability");
}

/** Decline a prospect's application. */
export async function rejectProspect(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(residents)
    .set({
      status: "rejected",
      waitlistedAt: null,
      bedId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  // Give back any bed they were holding.
  await releaseOrphanedReservedBeds(orgId);

  revalidatePath("/app/admissions");
  revalidatePath("/app");
  revalidatePath("/app/availability");
}

/** Move a prospect onto the waitlist (kept in FIFO order by waitlistedAt). */
export async function addToWaitlist(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(residents)
    .set({ waitlistedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(residents.id, id),
        eq(residents.orgId, orgId),
        eq(residents.status, "prospect"),
      ),
    );

  revalidatePath("/app/admissions");
  revalidatePath("/app");
}

/** Take a prospect back off the waitlist (returns to new-applications review). */
export async function removeFromWaitlist(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db
    .update(residents)
    .set({ waitlistedAt: null, updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  revalidatePath("/app/admissions");
  revalidatePath("/app");
}

/** Email a waitlisted prospect that a spot may be opening up. */
export async function notifyNextInLine(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [prospect] = await db
    .select({
      email: residents.email,
      firstName: residents.firstName,
      waitlistedAt: residents.waitlistedAt,
    })
    .from(residents)
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);
  if (!prospect?.email || !prospect.waitlistedAt) return;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const orgName = org?.name ?? siteConfig.name;

  const from =
    process.env.EMAIL_FROM ??
    "Helios Recovery Residences <onboarding@resend.dev>";

  try {
    await sendEmail({
      from,
      to: [prospect.email],
      subject: `A spot may be opening up at ${orgName}`,
      text: [
        `Hi ${prospect.firstName},`,
        "",
        `Good news — a spot may be opening up at ${orgName}, and you're near the top of our waitlist.`,
        "",
        `If you're still interested, please reply to this email or give us a call as soon as you can so we can hold your place.`,
        "",
        siteConfig.phone,
        "",
        orgName,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[waitlist] failed to notify prospect", err);
    return;
  }

  await db
    .update(residents)
    .set({ waitlistNotifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  revalidatePath("/app/admissions");
}

/** Text a waitlisted prospect that a spot may be opening up. */
export async function textNextInLine(formData: FormData) {
  const orgId = await adminOrgId();
  if (!orgId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [prospect] = await db
    .select({
      phone: residents.phone,
      firstName: residents.firstName,
      waitlistedAt: residents.waitlistedAt,
    })
    .from(residents)
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)))
    .limit(1);
  if (!prospect?.phone || !prospect.waitlistedAt) return;

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const orgName = org?.name ?? siteConfig.name;

  try {
    await sendSms({
      to: prospect.phone,
      text: `Hi ${prospect.firstName}, a spot may be opening up at ${orgName} and you're near the top of our waitlist. If you're still interested, please call us at ${siteConfig.phone} to hold your place.`,
    });
  } catch (err) {
    console.error("[waitlist] failed to text prospect", err);
    return;
  }

  await db
    .update(residents)
    .set({ waitlistNotifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(residents.id, id), eq(residents.orgId, orgId)));

  revalidatePath("/app/admissions");
}
