"use client";

import { useActionState } from "react";
import { money } from "@/lib/billing";
import { recordManualRefund, type RefundState } from "./actions";

const initialState: RefundState = { status: "idle" };
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

/**
 * Returning a cash deposit or a check. Card money is refunded from the payment
 * itself so Stripe stays the source of truth.
 */
export function ManualRefundForm({
  residentId,
  netPaidCents,
  today,
}: {
  residentId: string;
  netPaidCents: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(
    recordManualRefund,
    initialState,
  );

  return (
    <details className="mt-3 rounded-lg border border-border bg-surface-muted/40 p-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-red-700">
        Return cash, a check, or a deposit
      </summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="residentId" value={residentId} />
        <label className="text-sm">
          <span className="font-medium">Amount returned</span>
          <input
            name="amount"
            required
            inputMode="decimal"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Up to {money(netPaidCents)}
          </span>
        </label>
        <label className="text-sm">
          <span className="font-medium">How it was returned</span>
          <select name="method" required defaultValue="cash" className={fieldClass}>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="money_order">Money order</option>
            <option value="ach">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Date returned</span>
          <input
            type="date"
            name="refundedOn"
            defaultValue={today}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Reason</span>
          <select name="reason" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Select a reason
            </option>
            <option value="departure_or_policy">Deposit returned at departure</option>
            <option value="resident_request">Resident or payer requested it</option>
            <option value="duplicate">Duplicate payment</option>
            <option value="payment_error">Payment entered in error</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="font-medium">Internal note</span>
          <textarea
            name="note"
            required
            minLength={10}
            maxLength={1000}
            rows={2}
            placeholder="Who handed the money back, and what it settles."
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
            The money has actually left the house. This records what already
            happened; it does not move funds.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "Recording..." : "Record money returned"}
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
