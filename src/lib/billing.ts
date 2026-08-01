import type { RatePeriod } from "@/db/schema";

/**
 * Money is handled as integer cents everywhere except the database boundary,
 * where Postgres numeric arrives as a string. Never let a balance touch a
 * float.
 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Parses a typed-in dollar amount. Returns null when it isn't a real amount. */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** A bed's rate expressed as one week, whatever period it is stored in. */
export function weeklyCents(
  rate: string | null,
  period: RatePeriod,
): number | null {
  if (!rate) return null;
  const cents = toCents(rate);
  if (!cents) return null;
  switch (period) {
    case "daily":
      return cents * 7;
    case "weekly":
      return cents;
    case "biweekly":
      return Math.round(cents / 2);
    case "monthly":
      return Math.round((cents * 12) / 52);
  }
}

export const CHARGE_TYPE_LABELS = {
  rent: "Rent",
  deposit: "Deposit",
  admission_fee: "Admission fee",
  late_fee: "Late fee",
  damage: "Damage",
  other: "Other",
} as const;

export const PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  check: "Check",
  money_order: "Money order",
  card: "Card",
  ach: "Bank transfer",
  other: "Other",
} as const;
