"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestResidentCode, verifyResidentCode } from "@/lib/resident-auth";
import { RESIDENT_SESSION_COOKIE } from "@/lib/resident-session";
import { toE164 } from "@/lib/sms";

export type RequestCodeState = {
  status: "idle" | "sent" | "error";
  /** Normalized phone carried into the verify step. */
  phone?: string;
  message?: string;
};

export type VerifyCodeState = {
  status: "idle" | "error";
  message?: string;
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

async function clientMeta() {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || null;
  return { ip, userAgent: store.get("user-agent") };
}

export async function requestCodeAction(
  _prev: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  // Honeypot — real residents never fill this in.
  if (value(formData, "company")) {
    return { status: "sent", phone: "" };
  }

  const phone = value(formData, "phone");
  const e164 = toE164(phone);
  if (!e164) {
    return {
      status: "error",
      message: "Enter a valid 10-digit mobile number.",
    };
  }

  const { ip } = await clientMeta();
  const result = await requestResidentCode({ phone: e164, ip });

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return {
        status: "error",
        message: "Too many code requests. Please wait a few minutes and try again.",
      };
    }
    if (result.reason === "send_failed") {
      return {
        status: "error",
        message: "We could not send the text right now. Please try again shortly.",
      };
    }
    return { status: "error", message: "Enter a valid 10-digit mobile number." };
  }

  // Always the same response whether or not the number belongs to a resident.
  return { status: "sent", phone: e164 };
}

export async function verifyCodeAction(
  _prev: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const phone = value(formData, "phone");
  const code = value(formData, "code").replace(/\D/g, "");

  const { ip, userAgent } = await clientMeta();
  const result = await verifyResidentCode({ phone, code, ip, userAgent });

  if (!result.ok) {
    return {
      status: "error",
      message: "That code is not valid or has expired. Request a new one.",
    };
  }

  const store = await cookies();
  store.set(RESIDENT_SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
  });

  redirect("/me");
}
