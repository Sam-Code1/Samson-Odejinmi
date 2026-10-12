import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { ActionResult } from "./result";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
};

/** Server-side admin check. Backed by the `is_admin()` database function, not by anything the browser sends. */
export async function getAdminContext(): Promise<AdminContext | null> {
  if (!supabaseConfigured) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) return null;
  return { supabase, user: { id: user.id, email: user.email } };
}

type DbError = { code?: string; message?: string } | null | undefined;

/** Turns database errors into messages a person can act on. Never leaks SQL. */
export function dbError(error: DbError, fallback = "That didn't save. Please try again."): ActionResult {
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "That value is already in use. Choose a different one (for example a different slug)." };
  if (error.code === "23503") return { ok: false, error: "That item is linked to something that no longer exists, or is still in use." };
  if (error.code === "23514") return { ok: false, error: "One of the values isn't allowed. Check the form and try again." };
  if (error.code === "42501" || /row-level security|not authorised/i.test(error.message ?? "")) return { ok: false, error: "You don't have permission to do that." };
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST202") {
    return { ok: false, error: "The database is missing part of the Academy setup. Run supabase/migrations/0002_admin_cms.sql, then try again." };
  }
  return { ok: false, error: fallback };
}

function isRedirect(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

/** Wraps every admin server action: authorises on the server, then runs, and never throws raw errors at the UI. */
export async function runAdmin(fn: (ctx: AdminContext) => Promise<ActionResult>): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "You don't have permission to do that." };
  try {
    return await fn(ctx);
  } catch (e) {
    if (isRedirect(e)) throw e;
    return { ok: false, error: "Something unexpected went wrong. Nothing was saved." };
  }
}
