import { createClient } from "@supabase/supabase-js";
import type { AdminContext } from "./guard";
import { recordSecurityEvent } from "@/lib/security";

const WINDOW_MIN = 15;
const MAX_FAILURES = 5;

/**
 * Step-up confirmation for sensitive admin actions (ownership transfer, removing admins, granting Super Admin):
 * the admin re-enters their own password, checked server-side with a throwaway, non-persistent auth client.
 * Attempts are recorded in `security_attempts`; after 5 failures in 15 minutes it locks for the rest of the window.
 * The password is never stored or logged.
 */
export async function confirmPassword(ctx: AdminContext, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ctx.user.email) return { ok: false, error: "Your account has no email address to confirm with." };
  if (!password) return { ok: false, error: "Enter your password to confirm." };

  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await ctx.supabase.from("security_attempts").select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id).eq("kind", "admin_step_up").eq("success", false).gte("created_at", since);
  if ((count ?? 0) >= MAX_FAILURES) return { ok: false, error: `Too many incorrect attempts. Try again in ${WINDOW_MIN} minutes.` };

  const temp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await temp.auth.signInWithPassword({ email: ctx.user.email, password });
  if (!error) await temp.auth.signOut({ scope: "local" });
  await ctx.supabase.from("security_attempts").insert({ user_id: ctx.user.id, kind: "admin_step_up", success: !error });
  await recordSecurityEvent(error ? "admin_stepup_failed" : "admin_stepup_success", { userId: ctx.user.id, email: ctx.user.email });
  return error ? { ok: false, error: "That password isn't correct." } : { ok: true };
}
