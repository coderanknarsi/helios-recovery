"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  requestCodeAction,
  verifyCodeAction,
  type RequestCodeState,
  type VerifyCodeState,
} from "./actions";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

function formatPhone(e164: string) {
  const digits = e164.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return e164;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function ResidentLoginForm() {
  const [requestState, requestAction, requesting] = useActionState<
    RequestCodeState,
    FormData
  >(requestCodeAction, { status: "idle" });

  const [verifyState, verifyAction, verifying] = useActionState<
    VerifyCodeState,
    FormData
  >(verifyCodeAction, { status: "idle" });

  const codeRef = useRef<HTMLInputElement>(null);
  const sent = requestState.status === "sent";

  useEffect(() => {
    if (sent) codeRef.current?.focus();
  }, [sent]);

  if (sent) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          If {formatPhone(requestState.phone ?? "")} is on file for a current
          resident, we just texted a 6-digit code. It expires in 10 minutes.
        </p>

        <form action={verifyAction} noValidate className="space-y-4">
          <input type="hidden" name="phone" value={requestState.phone ?? ""} />
          <div>
            <label htmlFor="code" className="text-sm font-medium">
              6-digit code
            </label>
            <input
              ref={codeRef}
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              className={`${fieldClass} text-center text-2xl tracking-[0.4em]`}
            />
          </div>

          {verifyState.status === "error" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {verifyState.message}
            </p>
          )}

          <Button type="submit" size="lg" disabled={verifying} className="w-full">
            {verifying ? "Checking…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You&rsquo;ll stay signed in on this device, so you won&rsquo;t need
            another code unless you sign out.
          </p>
        </form>

        <form action={requestAction}>
          <input type="hidden" name="phone" value={requestState.phone ?? ""} />
          <button
            type="submit"
            disabled={requesting}
            className="text-sm font-medium text-primary transition hover:text-primary-hover disabled:opacity-60"
          >
            {requesting ? "Sending…" : "Send a new code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={requestAction} noValidate className="space-y-4">
      <div>
        <label htmlFor="phone" className="text-sm font-medium">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="(555) 123-4567"
          className={fieldClass}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use the number your house has on file. We&rsquo;ll text you a code
          once, then keep you signed in on this device.
        </p>
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {requestState.status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {requestState.message}
        </p>
      )}

      <Button type="submit" size="lg" disabled={requesting} className="w-full">
        {requesting ? "Sending…" : "Text me a code"}
      </Button>
    </form>
  );
}
