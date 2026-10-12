import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY service-role client. Used for exactly one thing: signing short-lived download links for private
 * course files AFTER the student's own session has proven (via RLS) they're enrolled and the resource is downloadable.
 * Never import this from a client component. Returns null if the key isn't configured.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
