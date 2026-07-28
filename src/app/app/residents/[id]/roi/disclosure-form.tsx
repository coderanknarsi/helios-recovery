"use client";

import { useState } from "react";
import { REDISCLOSURE_NOTICE, scopeLabel } from "@/lib/roi";
import { logDisclosure } from "./actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

/**
 * Records what was actually shared under a release. Only offers the scopes the
 * resident authorized — you cannot log a disclosure wider than the consent.
 */
export function DisclosureForm({
  roiId,
  residentId,
  scopes,
}: {
  roiId: string;
  residentId: string;
  scopes: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-primary transition hover:text-primary-hover"
      >
        Log a disclosure
      </button>
    );
  }

  return (
    <form
      action={logDisclosure}
      className="mt-3 space-y-3 rounded-lg border border-border bg-background p-4"
    >
      <input type="hidden" name="roiId" value={roiId} />
      <input type="hidden" name="residentId" value={residentId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            How it was shared
          </span>
          <select name="method" className={fieldClass}>
            <option value="phone">Phone call</option>
            <option value="email">Email</option>
            <option value="in person">In person</option>
            <option value="mail">Mail or fax</option>
            <option value="portal">Secure portal</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">
          What you shared
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {scopes.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="scopes"
                value={s}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring/40"
              />
              {scopeLabel(s)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          What you actually said or sent
        </span>
        <textarea
          name="summary"
          required
          rows={2}
          placeholder="Confirmed residency since Mar 3 and that the Jul 12 UA was negative."
          className={fieldClass}
        />
      </label>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">
          Notice to include with this disclosure
        </summary>
        <p className="mt-2 leading-relaxed">{REDISCLOSURE_NOTICE}</p>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Save to log
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
