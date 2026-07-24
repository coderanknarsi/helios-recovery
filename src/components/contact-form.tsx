"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "@/app/(marketing)/contact/actions";
import { Button } from "@/components/ui/button";

const initialState: ContactState = { status: "idle" };

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitContact,
    initialState
  );

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-8 text-center">
        <h3 className="text-xl font-semibold text-foreground">Message sent</h3>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Full name
          </label>
          <input id="name" name="name" required className={fieldClass} />
          <FieldError messages={state.errors?.name} />
        </div>
        <div>
          <label htmlFor="phone" className="text-sm font-medium">
            Phone <span className="text-muted-foreground">(optional)</span>
          </label>
          <input id="phone" name="phone" type="tel" className={fieldClass} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className={fieldClass} />
        <FieldError messages={state.errors?.email} />
      </div>

      <div>
        <label htmlFor="interest" className="text-sm font-medium">
          I&apos;m reaching out about
        </label>
        <select id="interest" name="interest" required className={fieldClass} defaultValue="self">
          <option value="self">Housing for myself</option>
          <option value="loved-one">Housing for a loved one</option>
          <option value="referral">A professional referral</option>
          <option value="other">Something else</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="text-sm font-medium">
          How can we help?
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className={fieldClass}
        />
        <FieldError messages={state.errors?.message} />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
