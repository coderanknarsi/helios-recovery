"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "helios-install-hint-dismissed";

/**
 * Nudges residents to add the portal to their home screen so it opens like an
 * app. Hidden once installed or dismissed. iOS Safari gives us no install
 * prompt API, so we show the manual steps instead.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari reports installed apps here instead.
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface-muted p-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 text-sm font-semibold">Keep this on your phone</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Add it to your home screen and it opens like an app — no password, no
        code to wait for.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {isIos ? (
          <>
            Tap
            <Share className="h-3.5 w-3.5 shrink-0" aria-label="Share" />
            <span className="font-medium text-foreground">Share</span>, then
            <span className="font-medium text-foreground">
              Add to Home Screen
            </span>
            .
          </>
        ) : (
          <>
            Open your browser menu
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            and choose
            <span className="font-medium text-foreground">
              Add to Home screen
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}
