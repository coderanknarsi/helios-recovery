"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";
import {
  deletePushSubscription,
  savePushSubscription,
} from "@/app/me/(portal)/push-actions";

/** VAPID keys travel as base64url; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "off"
  | "on"
  | "blocked";

export function NotificationSettings({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

      // iOS refuses to expose push at all until the app is on the home screen.
      if (isIos && !isStandalone) {
        if (!cancelled) setState("needs-install");
        return;
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    }

    init().catch(() => {
      if (!cancelled) setState("unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });

      setState(result.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      // Leave the UI as-is; the next load re-reads the real state.
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  if (state === "needs-install") {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 shrink-0 text-primary" />
          Reminders
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          To get reminders on an iPhone, add this to your home screen first: tap
          <Share className="h-3.5 w-3.5 shrink-0" aria-label="Share" />
          <span className="font-medium text-foreground">Share</span>, then
          <span className="font-medium text-foreground">Add to Home Screen</span>
          . Then open it from your home screen and come back here.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-sm font-semibold">Reminders</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This phone or browser can&rsquo;t receive reminders. Your house team
          will text you instead.
        </p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          Reminders are blocked
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          You turned these off in your phone&rsquo;s settings. To get them back,
          allow notifications for this app in your browser or phone settings.
        </p>
      </div>
    );
  }

  const on = state === "on";

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {on ? (
          <Bell className="h-4 w-4 shrink-0 text-accent" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        Reminders are {on ? "on" : "off"}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {on
          ? "You'll get a notification when there's something to sign or your house team sends you a message."
          : "Turn these on to hear about documents to sign and messages from your house team."}
      </p>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        className={`mt-3 inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium transition disabled:opacity-60 ${
          on
            ? "border border-border text-muted-foreground hover:border-red-300 hover:text-red-600"
            : "bg-primary text-primary-foreground hover:bg-primary-hover"
        }`}
      >
        {busy ? "Working…" : on ? "Turn off" : "Turn on reminders"}
      </button>
    </div>
  );
}
