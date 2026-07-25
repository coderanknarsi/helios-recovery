"use server";

import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().optional(),
  interest: z.enum(["self", "loved-one", "referral", "other"]),
  message: z.string().trim().min(10, "Please add a few details."),
  // Honeypot — must stay empty.
  company: z.string().max(0).optional(),
});

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    interest: formData.get("interest"),
    message: formData.get("message"),
    company: formData.get("company") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  // Silently drop bot submissions.
  if (parsed.data.company) {
    return { status: "success", message: "Thanks — we'll be in touch soon." };
  }

  const { name, email, phone, interest, message } = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_INBOX;
  // Once heliosrecoveryresidences.com is verified in Resend, set EMAIL_FROM to
  // e.g. "Helios Recovery Residences <admissions@heliosrecoveryresidences.com>".
  // Until then we fall back to Resend's shared onboarding sender.
  const from =
    process.env.EMAIL_FROM ??
    "Helios Recovery Residences <onboarding@resend.dev>";

  if (apiKey && to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject: `New inquiry from ${name} (${interest})`,
          text: [
            `Name: ${name}`,
            `Email: ${email}`,
            `Phone: ${phone ?? "—"}`,
            `Interest: ${interest}`,
            "",
            message,
          ].join("\n"),
        }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    } catch {
      return {
        status: "error",
        message:
          "Something went wrong sending your message. Please call us instead.",
      };
    }
  } else {
    // No email provider configured yet — log for local/preview visibility.
    console.info("[contact] submission received", {
      name,
      email,
      phone,
      interest,
    });
  }

  return {
    status: "success",
    message: "Thanks — we received your message and will be in touch soon.",
  };
}
