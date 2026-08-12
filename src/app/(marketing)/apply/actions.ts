"use server";

import { z } from "zod";
import { db } from "@/db";
import { residents } from "@/db/schema";
import { getDefaultOrgId } from "@/lib/org";
import { siteConfig } from "@/lib/site";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Use a valid date.",
  });

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : undefined));

const applicationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().min(7, "Enter a phone number we can reach you at."),
  dateOfBirth: optionalDate,
  sobrietyDate: optionalDate,
  substances: optionalText,
  treatmentHistory: optionalText,
  referralSource: optionalText,
  fundingSource: optionalText,
  desiredMoveInDate: optionalDate,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  emergencyContactRelation: optionalText,
  // No medication question here. Asking before an accept/reject decision is a
  // pre-offer disability inquiry under the FHA and ADA; staff collect it at
  // intake instead.
  legalHistory: optionalText,
  notes: optionalText,
  consent: z
    .string()
    .optional()
    .refine((v) => v === "on" || v === "true", {
      message: "Please confirm the information is accurate.",
    }),
  // Honeypot — must stay empty.
  company: z.string().max(0).optional(),
});

export type ApplicationState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

function line(label: string, value?: string | null) {
  return `${label}: ${value && value.length ? value : "—"}`;
}

async function sendEmail(payload: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData
): Promise<ApplicationState> {
  const parsed = applicationSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Silently drop bot submissions.
  if (data.company) {
    return {
      status: "success",
      message: "Thanks — we received your application.",
    };
  }

  // Persist the applicant as a prospect resident.
  try {
    const orgId = await getDefaultOrgId();
    await db.insert(residents).values({
      orgId,
      status: "prospect",
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      sobrietyDate: data.sobrietyDate,
      substances: data.substances,
      treatmentHistory: data.treatmentHistory,
      referralSource: data.referralSource,
      fundingSource: data.fundingSource,
      desiredMoveInDate: data.desiredMoveInDate,
      emergencyContactName: data.emergencyContactName,
      emergencyContactPhone: data.emergencyContactPhone,
      emergencyContactRelation: data.emergencyContactRelation,
      legalHistory: data.legalHistory,
      notes: data.notes,
    });
  } catch (err) {
    console.error("[apply] failed to save application", err);
    return {
      status: "error",
      message:
        "Something went wrong saving your application. Please try again or call us.",
    };
  }

  const from =
    process.env.EMAIL_FROM ??
    "Helios Recovery Residences <onboarding@resend.dev>";
  const inbox = process.env.CONTACT_INBOX;
  const fullName = `${data.firstName} ${data.lastName}`;

  // Notify admissions. Email failures must not lose a saved application.
  try {
    if (inbox) {
      await sendEmail({
        from,
        to: [inbox],
        reply_to: data.email,
        subject: `New application — ${fullName}`,
        text: [
          "A new bed application was submitted.",
          "",
          line("Name", fullName),
          line("Email", data.email),
          line("Phone", data.phone),
          line("Date of birth", data.dateOfBirth),
          line("Sobriety date", data.sobrietyDate),
          line("Substances", data.substances),
          line("Treatment history", data.treatmentHistory),
          line("Referral source", data.referralSource),
          line("Funding source", data.fundingSource),
          line("Desired move-in", data.desiredMoveInDate),
          "",
          "Emergency contact",
          line("  Name", data.emergencyContactName),
          line("  Phone", data.emergencyContactPhone),
          line("  Relation", data.emergencyContactRelation),
          "",
          line("Legal history", data.legalHistory),
          line("Notes", data.notes),
        ].join("\n"),
      });
    }

    // Confirmation to the applicant (best effort).
    await sendEmail({
      from,
      to: [data.email],
      subject: `We received your application — ${siteConfig.name}`,
      text: [
        `Hi ${data.firstName},`,
        "",
        `Thank you for applying to ${siteConfig.name}. We've received your application and a member of our team will reach out soon to talk through next steps.`,
        "",
        `If you need to reach us in the meantime, call ${siteConfig.phone}.`,
        "",
        "In recovery together,",
        siteConfig.name,
      ].join("\n"),
    });
  } catch (err) {
    console.error("[apply] application saved but email failed", err);
  }

  return {
    status: "success",
    message:
      "Your application is in. We'll be in touch shortly to talk through next steps.",
  };
}
