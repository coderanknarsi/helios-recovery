import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions, residentNotifications } from "@/db/schema";

let configured = false;

/** Configures VAPID once per process. Returns false if keys are missing. */
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type NotificationInput = {
  orgId: string;
  residentId: string;
  title: string;
  body: string;
  url?: string;
  sentBy?: string | null;
};

/**
 * Stores a notification and rings every device the resident has registered.
 *
 * The stored row is the source of truth — push is best-effort. A resident with
 * notifications off, an expired subscription, or no signal still sees the
 * message next time they open the portal.
 */
export async function notifyResident(input: NotificationInput) {
  const { orgId, residentId, title, body, url = "/me", sentBy = null } = input;

  const [row] = await db
    .insert(residentNotifications)
    .values({ orgId, residentId, title, body, url, sentBy })
    .returning({ id: residentNotifications.id });

  const delivered = await pushToResident({
    orgId,
    residentId,
    title,
    body,
    url,
    tag: row.id,
  });

  return { id: row.id, delivered };
}

/**
 * Sends a push to a resident's devices. Subscriptions the push service has
 * retired (404/410) are deleted so we stop paying attention to dead phones.
 */
export async function pushToResident(opts: {
  orgId: string;
  residentId: string;
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<number> {
  if (!ensureConfigured()) {
    console.warn("Push not configured — VAPID keys missing.");
    return 0;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.residentId, opts.residentId),
        eq(pushSubscriptions.orgId, opts.orgId),
      ),
    );

  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    url: opts.url,
    tag: opts.tag,
  });

  const stale: string[] = [];
  const reached: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        reached.push(sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          stale.push(sub.id);
        } else {
          console.error("Push send failed:", status, err);
        }
      }
    }),
  );

  if (stale.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, stale));
  }

  if (reached.length > 0) {
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: new Date() })
      .where(inArray(pushSubscriptions.id, reached));
  }

  return reached.length;
}
