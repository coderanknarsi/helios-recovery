"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  applicationContactAttempts,
  applicationDecisions,
  residents,
  beds,
  houses,
  organizations,
  type AccommodationReviewStatus,
  type ApplicationContactChannel,
  type ApplicationDeclineReason,
} from "@/db/schema";
import { adminOrgId, requireAdmin } from "@/lib/access";
import { siteConfig } from "@/lib/site";
import { sendSms } from "@/lib/sms";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DECLINE_REASONS: ApplicationDeclineReason[] = [
  "published_eligibility_not_met",
  "requested_services_outside_nonclinical_scope",
  "documented_direct_safety_risk",
  "other_policy_criterion",
];
const ACCOMMODATION_REVIEWS: AccommodationReviewStatus[] = [
  "not_applicable_or_not_requested",
  "request_considered",
  "accommodation_offered",
  "accommodation_declined",
];
const CONTACT_CHANNELS: ApplicationContactChannel[] = [
  "phone",
  "email",
  "text",
  "other",
];

export type ApplicationDecisionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

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

/** Log one factual attempt to reach a pending applicant. */
export async function recordApplicationContactAttempt(formData: FormData) {
  const access = await requireAdmin();
  const parsed = z
    .object({
      residentId: z.string().uuid(),
      channel: z.enum(CONTACT_CHANNELS),
      attemptedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().trim().min(5).max(500),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success || !CONTACT_CHANNELS.includes(parsed.data.channel)) return;

  const attemptedAt = new Date(`${parsed.data.attemptedOn}T12:00:00Z`);
  if (attemptedAt > new Date()) return;
  const [prospect] = await db
    .select({ id: residents.id })
    .from(residents)
    .where(
      and(
        eq(residents.id, parsed.data.residentId),
        eq(residents.orgId, access.orgId),
        eq(residents.status, "prospect"),
      ),
    )
    .limit(1);
  if (!prospect) return;

  await db.insert(applicationContactAttempts).values({
    orgId: access.orgId,
    residentId: prospect.id,
    channel: parsed.data.channel,
    attemptedAt,
    note: parsed.data.note,
    attemptedBy: access.profile.id,
  });
  revalidatePath("/app/admissions");
}

/** Close a pending application with a specific, immutable outcome. */
export async function closeApplication(
  _previous: ApplicationDecisionState,
  formData: FormData,
): Promise<ApplicationDecisionState> {
  const access = await requireAdmin();
  const base = z
    .object({
      residentId: z.string().uuid(),
      outcome: z.enum(["declined", "withdrawn", "unresponsive"]),
      declineReason: z.string().optional(),
      accommodationReview: z.string().optional(),
      note: z.string().trim().min(10).max(2000),
      confirmed: z.literal("on"),
    })
    .safeParse(Object.fromEntries(formData.entries()));
  if (!base.success) {
    return {
      status: "error",
      message: "Choose an outcome and add a factual note.",
    };
  }

  const [prospect] = await db
    .select({
      id: residents.id,
      email: residents.email,
      phone: residents.phone,
    })
    .from(residents)
    .where(
      and(
        eq(residents.id, base.data.residentId),
        eq(residents.orgId, access.orgId),
        eq(residents.status, "prospect"),
      ),
    )
    .limit(1);
  if (!prospect) {
    return { status: "error", message: "That application is no longer open." };
  }

  let declineReason: ApplicationDeclineReason | null = null;
  let accommodationReview: AccommodationReviewStatus | null = null;
  if (base.data.outcome === "declined") {
    if (
      !DECLINE_REASONS.includes(
        base.data.declineReason as ApplicationDeclineReason,
      ) ||
      !ACCOMMODATION_REVIEWS.includes(
        base.data.accommodationReview as AccommodationReviewStatus,
      ) ||
      base.data.note.length < 20
    ) {
      return {
        status: "error",
        message:
          "A denial needs an objective reason, accommodation review, and factual note.",
      };
    }
    declineReason = base.data.declineReason as ApplicationDeclineReason;
    accommodationReview =
      base.data.accommodationReview as AccommodationReviewStatus;
  }

  if (base.data.outcome === "unresponsive") {
    const attempts = await db
      .select({
        channel: applicationContactAttempts.channel,
        attemptedAt: applicationContactAttempts.attemptedAt,
      })
      .from(applicationContactAttempts)
      .where(
        and(
          eq(applicationContactAttempts.orgId, access.orgId),
          eq(applicationContactAttempts.residentId, prospect.id),
        ),
      );
    if (attempts.length < 3) {
      return {
        status: "error",
        message: "Log at least three contact attempts before closing.",
      };
    }
    const times = attempts.map((attempt) => attempt.attemptedAt.getTime());
    if (Math.max(...times) - Math.min(...times) < 7 * 86_400_000) {
      return {
        status: "error",
        message: "The contact attempts must span at least seven days.",
      };
    }
    if (prospect.email && prospect.phone) {
      const usedEmail = attempts.some((attempt) => attempt.channel === "email");
      const usedPhone = attempts.some((attempt) =>
        ["phone", "text"].includes(attempt.channel),
      );
      if (!usedEmail || !usedPhone) {
        return {
          status: "error",
          message: "Use both email and phone/text before closing for no response.",
        };
      }
    }
  }

  const nextStatus =
    base.data.outcome === "declined"
      ? "rejected"
      : base.data.outcome === "withdrawn"
        ? "withdrawn"
        : "unresponsive";

  await db.transaction(async (tx) => {
    await tx.insert(applicationDecisions).values({
      orgId: access.orgId,
      residentId: prospect.id,
      outcome: base.data.outcome,
      declineReason,
      note: base.data.note,
      accommodationReview,
      decidedBy: access.profile.id,
    });
    await tx
      .update(residents)
      .set({
        status: nextStatus,
        waitlistedAt: null,
        bedId: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(residents.id, prospect.id),
          eq(residents.orgId, access.orgId),
          eq(residents.status, "prospect"),
        ),
      );
  });

  await releaseOrphanedReservedBeds(access.orgId);
  revalidatePath("/app/admissions");
  revalidatePath("/app");
  revalidatePath("/app/availability");
  return { status: "success", message: "Application closed." };
}

/** Return a closed application to review without deleting its prior decision. */
export async function reopenApplication(formData: FormData) {
  const access = await requireAdmin();
  const residentId = String(formData.get("residentId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!z.string().uuid().safeParse(residentId).success || note.length < 10) return;

  await db.transaction(async (tx) => {
    const [closed] = await tx
      .select({ id: residents.id })
      .from(residents)
      .where(
        and(
          eq(residents.id, residentId),
          eq(residents.orgId, access.orgId),
          inArray(residents.status, ["rejected", "withdrawn", "unresponsive"]),
        ),
      )
      .limit(1);
    if (!closed) return;

    await tx.insert(applicationDecisions).values({
      orgId: access.orgId,
      residentId,
      outcome: "reopened",
      note,
      decidedBy: access.profile.id,
    });
    await tx
      .update(residents)
      .set({ status: "prospect", updatedAt: new Date() })
      .where(eq(residents.id, residentId));
  });

  revalidatePath("/app/admissions");
  revalidatePath("/app");
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
