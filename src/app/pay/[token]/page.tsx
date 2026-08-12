import type { Metadata } from "next";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { CheckCircle2, Lock } from "lucide-react";
import { db } from "@/db";
import { organizations, paymentLinks } from "@/db/schema";
import { money, toCents } from "@/lib/billing";
import { startCheckout } from "./actions";

export const metadata: Metadata = {
  title: "Make a payment",
  robots: { index: false, follow: false },
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;

  const [link] = await db
    .select({
      amount: paymentLinks.amount,
      label: paymentLinks.label,
      thirdParty: paymentLinks.thirdParty,
      orgName: organizations.name,
    })
    .from(paymentLinks)
    .innerJoin(organizations, eq(paymentLinks.orgId, organizations.id))
    .where(
      and(
        eq(paymentLinks.token, token),
        isNull(paymentLinks.revokedAt),
        or(isNull(paymentLinks.expiresAt), gt(paymentLinks.expiresAt, new Date())),
      ),
    )
    .limit(1);

  if (!link) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold">This link is no longer active</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Payment links expire. Ask for a new one.
          </p>
        </div>
      </main>
    );
  }

  const fixed = link.amount ? toCents(link.amount) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
      <div className="w-full">
        {paid && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold text-accent">Payment received</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your receipt is on its way by email. It can take a minute to show
                up on the account.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-base font-semibold">{link.orgName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rent payment for {link.label}
          </p>

          <form action={startCheckout} className="mt-5 space-y-4">
            <input type="hidden" name="token" value={token} />

            {fixed ? (
              <div className="rounded-lg border border-border bg-surface-muted px-3 py-3">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-lg font-semibold">{money(fixed)}</p>
              </div>
            ) : (
              <label className="block text-sm">
                <span className="font-medium">Amount</span>
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="200.00"
                  className={fieldClass}
                />
              </label>
            )}

            <label className="block text-sm">
              <span className="font-medium">
                Who is paying?
                {!link.thirdParty && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (leave blank if it is you)
                  </span>
                )}
              </span>
              <input
                name="payerName"
                required={link.thirdParty}
                placeholder={
                  link.thirdParty ? "Organization name" : "Your name or organization"
                }
                className={fieldClass}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                We tell the resident who paid on their behalf.
              </span>
            </label>

            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Continue to payment
            </button>
          </form>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Card details are handled by Stripe. We never see them.
        </p>
      </div>
    </main>
  );
}
