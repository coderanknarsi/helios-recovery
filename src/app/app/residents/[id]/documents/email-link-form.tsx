"use client";

import { useActionState } from "react";
import { Mail, MessageSquare, Check } from "lucide-react";
import { sendSigningLink, type EmailLinkState } from "./actions";

const initialState: EmailLinkState = { status: "idle" };

export function EmailLinkForm({
  residentId,
  hasEmail,
  hasPhone,
  activeLink,
}: {
  residentId: string;
  hasEmail: boolean;
  hasPhone: boolean;
  activeLink: string | null;
}) {
  const [state, action, pending] = useActionState(
    sendSigningLink,
    initialState,
  );

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-muted/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Remote signing
          </p>
          <p className="text-xs text-muted-foreground">
            {hasEmail || hasPhone
              ? "Send the resident a secure link to sign from their phone."
              : "Add an email or phone number to send a signing link."}
          </p>
        </div>
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="residentId" value={residentId} />
          <button
            type="submit"
            name="channel"
            value="email"
            disabled={pending || !hasEmail}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {pending ? "Sending…" : activeLink ? "Re-email" : "Email"}
          </button>
          <button
            type="submit"
            name="channel"
            value="text"
            disabled={pending || !hasPhone}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare className="h-4 w-4" />
            {pending ? "Sending…" : activeLink ? "Re-text" : "Text"}
          </button>
        </form>
      </div>

      {state.status === "sent" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent">
          <Check className="h-4 w-4" />
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-3 text-sm text-red-600">{state.message}</p>
      )}

      {activeLink && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
            Active signing link (expires in 30 days):
          </p>
          <input
            readOnly
            value={activeLink}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground outline-none"
          />
        </div>
      )}
    </div>
  );
}
