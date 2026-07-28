"use client";

import { useState } from "react";
import { addLog } from "./actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const typeOptions = [
  { value: "note", label: "Note" },
  { value: "drug_test", label: "Drug test" },
  { value: "infraction", label: "Infraction" },
  { value: "pass", label: "Overnight pass" },
  { value: "chore", label: "Chore" },
  { value: "medication", label: "Medication" },
];

const titlePlaceholder: Record<string, string> = {
  note: "Short summary",
  drug_test: "Method — e.g. UA or BA",
  infraction: "Category — e.g. Curfew",
  pass: "Destination",
  chore: "Chore name",
  medication: "Medication & dosage",
};

export function AddLogForm({ residentId }: { residentId: string }) {
  const [type, setType] = useState("note");
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <form action={addLog} className="space-y-3">
      <input type="hidden" name="residentId" value={residentId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Type
          </span>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={fieldClass}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Date
          </span>
          <input
            type="date"
            name="occurredAt"
            defaultValue={todayStr}
            className={fieldClass}
          />
        </label>
        {type === "drug_test" && (
          <label className="text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Result
            </span>
            <select name="result" defaultValue="pass" className={fieldClass}>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="refused">Refused</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        )}
      </div>
      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">Title</span>
        <input
          name="title"
          placeholder={titlePlaceholder[type]}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          Details
        </span>
        <textarea name="detail" rows={2} className={fieldClass} />
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="visibleToResident"
          // Remount when the type changes so the default can follow it.
          key={type}
          defaultChecked={type === "drug_test"}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
        />
        <span className="text-muted-foreground">
          Show this to the resident in their portal.
          {type === "drug_test" &&
            " Residents have a right to their own test results."}
        </span>
      </label>
      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
      >
        Add entry
      </button>
    </form>
  );
}
