/**
 * Minimal Telnyx SMS helper.
 * Requires TELNYX_API_KEY and TELNYX_FROM_NUMBER (E.164, e.g. +17123179168).
 */

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX). Returns null if unusable. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Send an SMS via the Telnyx Messaging API. Throws on failure. */
export async function sendSms({ to, text }: { to: string; text: string }) {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !from) {
    throw new Error("Telnyx is not configured (missing API key or from number).");
  }

  const e164 = toE164(to);
  if (!e164) throw new Error("Invalid phone number.");

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: e164, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telnyx responded ${res.status}: ${body}`);
  }
}
