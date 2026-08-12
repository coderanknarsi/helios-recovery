import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  RESIDENT_SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/resident-session";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Slide the resident session cookie forward on every page view. Server
  // components cannot set cookies, so without this the browser cookie would
  // expire on a fixed schedule and force an unnecessary (paid) SMS sign-in
  // even for someone who opens the portal daily.
  //
  // GET only: server actions are POSTs, and sign-out clears this same cookie
  // in its own response — re-setting it here would fight that.
  const token = request.cookies.get(RESIDENT_SESSION_COOKIE)?.value;
  if (token && request.method === "GET") {
    response.cookies.set(RESIDENT_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and images. Stripe webhooks
     * are excluded so nothing can touch the raw body before it is verified.
     */
    "/((?!_next/static|_next/image|api/stripe|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
