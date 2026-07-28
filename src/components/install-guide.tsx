"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Share,
  Plus,
  CheckCircle2,
  Smartphone,
  MoreVertical,
  Bell,
  WifiOff,
} from "lucide-react";

type Platform = "loading" | "installed" | "ios" | "android" | "desktop";

function detect(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;
  if (standalone) return "installed";

  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Full-page walkthrough for adding the resident portal to a phone. */
export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>("loading");

  useEffect(() => {
    setPlatform(detect());
  }, []);

  if (platform === "loading") {
    return <div className="h-64" aria-hidden="true" />;
  }

  if (platform === "installed") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-accent" />
        <h2 className="mt-3 text-lg font-semibold">You&rsquo;re all set</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This is already on your home screen. Sign in and you&rsquo;re done.
        </p>
        <Link
          href="/me"
          className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {platform === "desktop" ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <Smartphone className="h-6 w-6 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Open this on your phone</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This is built for your phone. Go to{" "}
            <span className="font-medium text-foreground">
              heliosrecoveryresidences.com/install
            </span>{" "}
            in your phone&rsquo;s browser and the steps will show up there.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            You can still{" "}
            <Link
              href="/me"
              className="font-medium text-primary hover:text-primary-hover"
            >
              sign in here
            </Link>{" "}
            on this computer.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          <Step number={1} title="Add it to your home screen">
            {platform === "ios" ? (
              <span className="flex flex-wrap items-center gap-1.5">
                Tap the
                <Share className="h-4 w-4 shrink-0" aria-label="Share" />
                <span className="font-medium text-foreground">Share</span>
                button at the bottom of Safari, scroll down, and tap
                <span className="font-medium text-foreground">
                  Add to Home Screen
                </span>
                .
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                Tap the
                <MoreVertical className="h-4 w-4 shrink-0" aria-label="Menu" />
                menu in Chrome, then tap
                <span className="font-medium text-foreground">Install app</span>
                or
                <span className="font-medium text-foreground">
                  Add to Home screen
                </span>
                .
              </span>
            )}
          </Step>

          <Step number={2} title="Open it from your home screen">
            Look for the{" "}
            <span className="font-medium text-foreground">Helios Recovery</span>{" "}
            icon with the other apps on your phone and tap it.
          </Step>

          <Step number={3} title="Sign in there">
            {platform === "ios" ? (
              <>
                Enter your phone number and we&rsquo;ll text you a code.{" "}
                <span className="font-medium text-foreground">
                  Sign in inside the app you just added, not in Safari
                </span>{" "}
                &mdash; iPhones keep them separate, so signing in here first
                means doing it twice.
              </>
            ) : (
              <>
                Enter your phone number and we&rsquo;ll text you a code. You
                stay signed in after that.
              </>
            )}
          </Step>
        </ol>
      )}

      <div className="rounded-2xl border border-border bg-surface-muted/50 p-5">
        <h3 className="text-sm font-semibold">Why bother</h3>
        <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Get a heads-up when something needs signing or your house team
              messages you.
              {platform === "ios" && (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    On iPhone this only works once it&rsquo;s on your home
                    screen.
                  </span>
                </>
              )}
            </span>
          </li>
          <li className="flex gap-2.5">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              House rules, curfew, and crisis numbers still load with bad
              signal.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Opens in one tap. No password to remember.</span>
          </li>
        </ul>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Rather skip it?{" "}
        <Link
          href="/me"
          className="font-medium text-primary hover:text-primary-hover"
        >
          Sign in in your browser
        </Link>
        .
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

/**
 * Small pre-login nudge. iPhones give a home-screen app its own storage, so a
 * resident who signs in here and installs afterwards has to request a second
 * code — which costs us a text and costs them patience.
 */
export function InstallFirstNotice() {
  const [platform, setPlatform] = useState<Platform>("loading");

  useEffect(() => {
    setPlatform(detect());
  }, []);

  if (platform !== "ios" && platform !== "android") return null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface-muted/60 p-4">
      <p className="text-sm font-semibold">Add this to your home screen first</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {platform === "ios"
          ? "Then sign in from there — iPhones treat them as separate, so doing it the other way means waiting on two codes."
          : "It opens like an app and you can get reminders."}
      </p>
      <Link
        href="/install"
        className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3.5 text-sm font-medium transition hover:border-primary hover:text-primary"
      >
        Show me how
      </Link>
    </div>
  );
}
