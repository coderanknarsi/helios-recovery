"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, residentNotifications } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";

export type SubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Registers a device for push. The resident comes from the session, so a
 * subscription can never be attached to somebody else's account.
 */
export async function savePushSubscription(sub: SubscriptionPayload) {
  const me = await requireResident();
  if (!sub?.endpoint || !sub.p256dh || !sub.auth) return { ok: false };

  const userAgent = (await headers()).get("user-agent");

  await db
    .insert(pushSubscriptions)
    .values({
      orgId: me.orgId,
      residentId: me.residentId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent,
    })
    // Re-subscribing returns the same endpoint; move it to the current
    // resident in case the device changed hands.
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        orgId: me.orgId,
        residentId: me.residentId,
        p256dh: sub.p256dh,
        auth: sub.auth,
        userAgent,
      },
    });

  return { ok: true };
}

/** Turns notifications off for this device. */
export async function deletePushSubscription(endpoint: string) {
  const me = await requireResident();
  if (!endpoint) return { ok: false };

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.residentId, me.residentId),
      ),
    );

  return { ok: true };
}

/** Marks everything the resident has been sent as read. */
export async function markNotificationsRead() {
  const me = await requireResident();

  await db
    .update(residentNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(residentNotifications.residentId, me.residentId),
        eq(residentNotifications.orgId, me.orgId),
        isNull(residentNotifications.readAt),
      ),
    );

  revalidatePath("/me");
}
