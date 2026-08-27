"use client";

import { useActionState } from "react";
import { money } from "@/lib/billing";
import {
  requestStripeRefund,
  type RefundState,
} from "./actions";

const initialState: RefundState = { status: "idle" };
const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export function RefundPaymentForm({
  paymentId,
  remainingCents,
  payerName,
}: {
  paymentId: string;
  remainingCents: number;
  payerName: string | null;
}) {
  const [state, action, pending] = useActionState(
    requestStripeRefund,
    initialState,
  );

  return (
    <details className="mt-2 rounded-lg border border-border bg-surface-muted/40 p-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-red-700">
        Refund this card payment
      </summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="paymentId" value={paymentId} />
        <label className="text-sm">
          <span className="font-medium">Amount</span>
          <input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={(remainingCents / 100).toFixed(2)}
            className={fieldClass}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Up to {money(remainingCents)}
          </span>
        </label>
        <label className="text-sm">
          <span className="font-medium">Reason</span>
          <select name="reason" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Select a reason
            </option>
            <option value="resident_request">Resident or payer requested it</option>
            <option value="duplicate">Duplicate payment</option>
            <option value="payment_error">Payment entered in error</option>
            <option value="departure_or_policy">Departure or written policy</option>
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
            placeholder="State the factual reason for returning the money."
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
            Return up to {money(remainingCents)} to the original payment method
            {payerName ? ` used by ${payerName}` : ""}. This does not waive the
            underlying charge.
          </span>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
          >
            {pending ? "Requesting refund..." : "Request refund"}
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