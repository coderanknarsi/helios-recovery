"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RESIDENT_SESSION_COOKIE } from "@/lib/resident-session";
import { revokeResidentSession } from "@/lib/resident-auth";

export async function signOutResident() {
  const store = await cookies();
  const token = store.get(RESIDENT_SESSION_COOKIE)?.value;
  if (token) await revokeResidentSession(token);
  store.delete(RESIDENT_SESSION_COOKIE);
  redirect("/me/login");
}
