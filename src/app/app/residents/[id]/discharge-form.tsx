"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { dischargeResident } from "./actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const reasons = [
  { value: "completed_program", label: "Completed the program", planned: true },
  {
    value: "planned_transfer",
    label: "Planned move on or transfer",
    planned: true,
  },
  { value: "left_early", label: "Left early, against advice", planned: false },
  { value: "rule_violation", label: "Rule violation", planned: false },
  { value: "substance_use", label: "Alcohol or other drug use", planned: false },
  { value: "overdose", label: "Overdose", planned: false },
  {
    value: "arrest_incarceration",
    label: "Arrest or incarceration",
    planned: false,
  },
  {
    value: "medical_behavioral",
    label: "Medical or behavioral health need",
    planned: false,
  },
  { value: "death", label: "Death", planned: false },
  { value: "other", label: "Other", planned: false },
];

export function DischargeForm({
  residentId,
  firstName,
  today,
}: {
  residentId: string;
  firstName: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const selected = reasons.find((r) => r.value === reason);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
      >
        <LogOut className="h-4 w-4" />
        Record discharge
      </button>
    );
  }

  return (
    <form action={dischargeResident} className="space-y-4">
      <input type="hidden" name="residentId" value={residentId} />

      <div>
        <h3 className="text-base font-semibold">Discharge {firstName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This frees the bed and ends portal access straight away. Fill in what
          you know now &mdash; how someone left is the part you cannot
          reconstruct later.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Date they left</span>
          <input
            type="date"
            name="exitDate"
            defaultValue={today}
            className={fieldClass}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Reason</span>
          <select
            name="reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={fieldClass}
          >
            <option value="">Choose one</option>
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reason && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="planned"
            defaultChecked={selected?.planned}
            // Remount so the default tracks the reason the user just picked.
            key={reason}
            className="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
          />
          This was a planned departure
        </label>
      )}

      {reason === "other" && (
        <label className="block text-sm">
          <span className="font-medium">What happened</span>
          <input name="reasonDetail" className={fieldClass} />
        </label>
      )}

      <label className="block text-sm">
        <span className="font-medium">
          How involved were they in house life?
        </span>
        <select name="participation" className={fieldClass} defaultValue="">
          <option value="">Not recorded</option>
          <option value="none">Not at all</option>
          <option value="low">A little</option>
          <option value="moderate">Fairly involved</option>
          <option value="high">Very involved</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Summary of progress</span>
        <textarea
          name="progressSummary"
          rows={3}
          placeholder="What changed for them while they were here."
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">
          In their words &mdash; what worked, what didn&rsquo;t
        </span>
        <textarea
          name="residentStatement"
          rows={3}
          placeholder="Ask them directly and write what they say."
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Worth getting verbatim. This is the evidence no report can fake.
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Ongoing recovery plan</span>
        <textarea
          name="ongoingRecoveryPlan"
          rows={2}
          placeholder="Where they're living, meetings, sponsor, work, follow-up."
          className={fieldClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Referrals given</span>
        <textarea
          name="referrals"
          rows={2}
          placeholder="Who you connected them with on the way out."
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Residents have a right to be referred on to further support.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium">Forwarding address</span>
          <input name="forwardingAddress" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Phone</span>
          <input name="forwardingPhone" className={fieldClass} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input name="forwardingEmail" className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Record discharge
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-primary hover:text-primary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
