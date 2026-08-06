"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  fileGrievance,
  type FileGrievanceState,
} from "./actions";
import {
  GRIEVANCE_ABOUT_HINTS,
  GRIEVANCE_ABOUT_LABELS,
  GRIEVANCE_ABOUT_VALUES,
} from "@/lib/grievances";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export function GrievanceForm() {
  const [about, setAbout] = useState("");
  const [state, action, pending] = useActionState<
    FileGrievanceState,
    FormData
  >(fileGrievance, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setAbout("");
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={action} className="mt-4 space-y-4">
      <div>
        <label htmlFor="about" className="text-sm font-medium">
          What is this about?
        </label>
        <select
          id="about"
          name="about"
          required
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          className={fieldClass}
        >
          <option value="">Choose one</option>
          {GRIEVANCE_ABOUT_VALUES.map((v) => (
            <option key={v} value={v}>
              {GRIEVANCE_ABOUT_LABELS[v]}
            </option>
          ))}
        </select>
        {about && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {GRIEVANCE_ABOUT_HINTS[about as keyof typeof GRIEVANCE_ABOUT_HINTS]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="subject" className="text-sm font-medium">
          In one line
        </label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={200}
          placeholder="Heat has been off in the back bedroom"
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="detail" className="text-sm font-medium">
          What happened?
        </label>
        <textarea
          id="detail"
          name="detail"
          required
          rows={5}
          placeholder="Include when it happened and who was there, if that matters."
          className={fieldClass}
        />
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          name="anonymous"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
        />
        <span className="text-sm">
          Send this anonymously
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Your name is not stored. Nobody can tell it was you, but we also
            cannot come back to you with questions or an outcome.
          </span>
        </span>
      </label>

      {state.message && (
        <p
          className={
            state.status === "error"
              ? "text-sm font-medium text-red-700"
              : "text-sm font-medium text-accent"
          }
        >
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
        >
          {pending ? "Sending..." : "Send it"}
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Retaliation is itself a violation
        </span>
      </div>
    </form>
  );
}
