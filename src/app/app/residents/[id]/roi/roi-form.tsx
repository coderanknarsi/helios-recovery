"use client";

import { useState } from "react";
import { ROI_SCOPES } from "@/lib/roi";
import { createRoi } from "./actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

/** Common expiry choices, in days from today. */
const presets = [
  { label: "90 days", days: 90 },
  { label: "6 months", days: 182 },
  { label: "1 year", days: 365 },
];

function dateIn(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function RoiForm({ residentId }: { residentId: string }) {
  const [expiresAt, setExpiresAt] = useState(() => dateIn(365));
  const [consentType, setConsentType] = useState("granular");

  return (
    <form action={createRoi} className="space-y-4">
      <input type="hidden" name="residentId" value={residentId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Recipient name
          </span>
          <input
            name="recipientName"
            required
            placeholder="Jane Doe"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Their role
          </span>
          <input
            name="recipientRole"
            required
            placeholder="Probation officer"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Organization
          </span>
          <input
            name="recipientOrganization"
            placeholder="Clay County District Court"
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Release type
          </span>
          <select
            name="consentType"
            value={consentType}
            onChange={(e) => setConsentType(e.target.value)}
            className={fieldClass}
          >
            <option value="granular">Specific release</option>
            <option value="tpo">Care coordination</option>
            <option value="legal_proceeding">Legal proceeding</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Their phone
          </span>
          <input name="recipientPhone" className={fieldClass} />
        </label>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Their email
          </span>
          <input name="recipientEmail" type="email" className={fieldClass} />
        </label>
      </div>

      {consentType === "legal_proceeding" && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
          A release for use in a legal proceeding must stand on its own. Do not
          fold it into an existing care-coordination release.
        </p>
      )}

      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">
          What this person may receive
        </legend>
        <div className="mt-2 space-y-2">
          {ROI_SCOPES.map((scope) => (
            <label key={scope.value} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="scopes"
                value={scope.value}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
              />
              <span className="text-sm">
                <span className="font-medium">{scope.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {scope.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          Why it is being shared
        </span>
        <textarea
          name="purpose"
          required
          rows={2}
          placeholder="Probation compliance monitoring"
          className={fieldClass}
        />
      </label>

      <div>
        <label className="block text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            Expires on
          </span>
          <input
            type="date"
            name="expiresAt"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setExpiresAt(dateIn(p.days))}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
      >
        Create release
      </button>
      <p className="text-xs text-muted-foreground">
        This creates an unsigned document. The resident signs it from their
        portal or the documents list before anything can be disclosed.
      </p>
    </form>
  );
}
