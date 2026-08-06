"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { grievances } from "@/db/schema";
import { requireResident } from "@/lib/resident-access";
import { GRIEVANCE_ABOUT_VALUES } from "@/lib/grievances";

export type FileGrievanceState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function fileGrievance(
  _prev: FileGrievanceState,
  formData: FormData,
): Promise<FileGrievanceState> {
  const me = await requireResident();

  const about = String(formData.get("about") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim();
  const anonymous = formData.get("anonymous") === "on";

  if (!GRIEVANCE_ABOUT_VALUES.includes(about as never)) {
    return { status: "error", message: "Choose what this is about." };
  }
  if (subject.length < 3) {
    return { status: "error", message: "Add a short summary." };
  }
  if (detail.length < 10) {
    return {
      status: "error",
      message: "Tell us a bit more so we can act on it.",
    };
  }

  await db.insert(grievances).values({
    orgId: me.orgId,
    houseId: me.houseId,
    // Anonymous means anonymous. We store no link back, not even a hidden one.
    residentId: anonymous ? null : me.residentId,
    about: about as (typeof GRIEVANCE_ABOUT_VALUES)[number],
    subject,
    detail,
    // A complaint about staff must never land in the inbox of the person named.
    adminOnly: about === "staff",
  });

  revalidatePath("/me/support");
  revalidatePath("/app/grievances");
  revalidatePath("/app/today");

  return {
    status: "success",
    message: anonymous
      ? "Sent anonymously. We cannot reply to you directly, but it will be looked into."
      : "Sent. You'll see updates here.",
  };
}
