"use client";

import { useActionState, useRef, useState } from "react";
import {
  submitApplication,
  type ApplicationState,
} from "@/app/(marketing)/apply/actions";
import { Button } from "@/components/ui/button";

const initialState: ApplicationState = { status: "idle" };

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const steps = ["About you", "Your recovery", "Safety & details"];

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {optional && (
        <span className="ml-1 text-muted-foreground">(optional)</span>
      )}
    </label>
  );
}

export function ApplicationForm() {
  const [state, formAction, pending] = useActionState(
    submitApplication,
    initialState
  );
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-10 text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          Application received
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          {state.message}
        </p>
      </div>
    );
  }

  // Validate the visible step before advancing.
  const next = () => {
    const section = formRef.current?.querySelector<HTMLElement>(
      `[data-step="${step}"]`
    );
    const inputs = section?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    for (const el of inputs ?? []) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return;
      }
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));
  const isLast = step === steps.length - 1;

  // Only allow the form to actually submit from the final step. This guards
  // against accidental submits (e.g. pressing Enter on an earlier step).
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLast) e.preventDefault();
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-8"
      noValidate
    >
      {/* Honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {/* Progress */}
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-sm font-medium sm:inline ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-border" />
            )}
          </li>
        ))}
      </ol>

      {/* Step 1 — About you */}
      <div data-step="0" hidden={step !== 0} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <input id="firstName" name="firstName" required className={fieldClass} />
            <FieldError messages={state.errors?.firstName} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <input id="lastName" name="lastName" required className={fieldClass} />
            <FieldError messages={state.errors?.lastName} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email</Label>
            <input id="email" name="email" type="email" required className={fieldClass} />
            <FieldError messages={state.errors?.email} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <input id="phone" name="phone" type="tel" required className={fieldClass} />
            <FieldError messages={state.errors?.phone} />
          </div>
        </div>
        <div className="sm:w-1/2 sm:pr-2.5">
          <Label htmlFor="dateOfBirth" optional>
            Date of birth
          </Label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" className={fieldClass} />
        </div>
      </div>

      {/* Step 2 — Your recovery */}
      <div data-step="1" hidden={step !== 1} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="sobrietyDate" optional>
              Sobriety date
            </Label>
            <input id="sobrietyDate" name="sobrietyDate" type="date" className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="desiredMoveInDate" optional>
              Desired move-in date
            </Label>
            <input
              id="desiredMoveInDate"
              name="desiredMoveInDate"
              type="date"
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="substances" optional>
            Substance(s) you&apos;re recovering from
          </Label>
          <input id="substances" name="substances" className={fieldClass} />
        </div>
        <div>
          <Label htmlFor="treatmentHistory" optional>
            Treatment history
          </Label>
          <textarea
            id="treatmentHistory"
            name="treatmentHistory"
            rows={3}
            placeholder="Detox, inpatient, IOP, prior sober living, etc."
            className={fieldClass}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="referralSource" optional>
              How did you hear about us?
            </Label>
            <input id="referralSource" name="referralSource" className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="fundingSource" optional>
              How will you cover rent?
            </Label>
            <select
              id="fundingSource"
              name="fundingSource"
              className={fieldClass}
              defaultValue=""
            >
              <option value="">Select one…</option>
              <option value="Self-pay">Self-pay</option>
              <option value="Family support">Family support</option>
              <option value="Insurance">Insurance</option>
              <option value="Scholarship/Grant">Scholarship / Grant</option>
              <option value="Voucher/State funding">Voucher / State funding</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Step 3 — Safety & details */}
      <div data-step="2" hidden={step !== 2} className="space-y-5">
        <fieldset className="space-y-5 rounded-xl border border-border p-5">
          <legend className="px-1 text-sm font-semibold">
            Emergency contact
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="emergencyContactName" optional>
                Name
              </Label>
              <input
                id="emergencyContactName"
                name="emergencyContactName"
                className={fieldClass}
              />
            </div>
            <div>
              <Label htmlFor="emergencyContactPhone" optional>
                Phone
              </Label>
              <input
                id="emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="sm:w-1/2 sm:pr-2.5">
            <Label htmlFor="emergencyContactRelation" optional>
              Relationship
            </Label>
            <input
              id="emergencyContactRelation"
              name="emergencyContactRelation"
              className={fieldClass}
            />
          </div>
        </fieldset>

        <div>
          <Label htmlFor="medications" optional>
            Current medications
          </Label>
          <textarea id="medications" name="medications" rows={2} className={fieldClass} />
        </div>
        <div>
          <Label htmlFor="legalHistory" optional>
            Legal history, probation, or upcoming court dates
          </Label>
          <textarea id="legalHistory" name="legalHistory" rows={2} className={fieldClass} />
        </div>
        <div>
          <Label htmlFor="notes" optional>
            Anything else we should know?
          </Label>
          <textarea id="notes" name="notes" rows={3} className={fieldClass} />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-muted/40 p-4">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">
            I confirm the information above is accurate and I consent to Helios
            Recovery Residences contacting me about my application.
          </span>
        </label>
        <FieldError messages={state.errors?.consent} />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          disabled={step === 0 || pending}
          className={step === 0 ? "invisible" : ""}
        >
          Back
        </Button>

        {isLast ? (
          <Button key="submit" type="submit" size="lg" disabled={pending}>
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        ) : (
          <Button key="continue" type="button" size="lg" onClick={next}>
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}
