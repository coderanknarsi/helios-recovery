import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key. Bypasses RLS, so it
 * must never be imported into client components. Used for private document
 * storage (uploads, signed URLs, deletes).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service credentials are not configured.");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
