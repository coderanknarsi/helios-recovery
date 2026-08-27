"use client";

import { useActionState, useState } from "react";
import {
  closeApplication,
  type ApplicationDecisionState,
} from "./actions";

const initialState: ApplicationDecisionState = { status: "idle" };
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export function ApplicationDecisionForm({ residentId }: { residentId: string }) {
  const [outcome, setOutcome] = useState("declined");
  const [state, action, pending] = useActionState(
    closeApplication,
    initialState,
  );
  const declined = outcome === "declined";

  return (
    <details className="ml-auto">
      <summary className="cursor-pointer list-none rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-red-600">
        Close application
      </summary>
      <form
        action={action}
        className="mt-3 grid min-w-0 gap-3 rounded-lg border border-border bg-surface-muted/40 p-4 sm:w-[34rem] sm:grid-cols-2"
      >
        <input type="hidden" name="residentId" value={residentId} />
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Outcome</span>
          <select
            name="outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className={fieldClass}
          >
            <option value="declined">Decline under a written criterion</option>
            <option value="withdrawn">Applicant withdrew</option>
            <option value="unresponsive">Close after no response</option>
          </select>
        </label>

        {declined && (
          <>
            <label className="text-sm">
              <span className="font-medium">Objective reason</span>
              <select name="declineReason" required className={fieldClass}>
                <option value="">Select a reason</option>
                <option value="published_eligibility_not_met">
                  Published eligibility criterion not met
                </option>
                <option value="requested_services_outside_nonclinical_scope">
                  Requested services outside nonclinical scope
                </option>
                <option value="documented_direct_safety_risk">
                  Documented direct safety risk
                </option>
                <option value="other_policy_criterion">
                  Another written policy criterion
                </option>
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Accommodation review</span>
              <select name="accommodationReview" required className={fieldClass}>
                <option value="">Select review status</option>
                <option value="not_applicable_or_not_requested">
                  Not applicable or not requested
                </option>
                <option value="request_considered">Request considered</option>
                <option value="accommodation_offered">Accommodation offered</option>
                <option value="accommodation_declined">
                  Accommodation declined by applicant
                </option>
              </select>
            </label>
          </>
        )}

        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Factual note</span>
          <textarea
            name="note"
            required
            minLength={declined ? 20 : 10}
            maxLength={2000}
            rows={3}
            placeholder={
              declined
                ? "Identify the written criterion and the observable facts. Do not enter a diagnosis or protected characteristic."
                : outcome === "withdrawn"
                  ? "Record who communicated the withdrawal and when."
                  : "Summarize the documented attempts. The system verifies count, dates, and channels."
            }
            className={fieldClass}
          />
        </label>
        <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
          <input
            type="checkbox"
            name="confirmed"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring/40"
          />
          <span>
            I confirm this record is factual and does not use disability,
            diagnosis, medication, religion, race, sex, or another protected
            characteristic as the reason.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save outcome"}
          </button>
          {state.message && (
            <p
              className={`mt-2 text-xs ${
                state.status === "success" ? "text-accent" : "text-red-700"
              }`}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}