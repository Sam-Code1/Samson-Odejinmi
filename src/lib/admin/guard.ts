import { cache } from "react";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import type { ActionResult } from "./result";
import { can, isAdminRole, type AdminRole, type Permission } from "./roles";

export type AdminContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  role: AdminRole;
  can: (p: Permission) => boolean;
};

/**
 * Server-side admin check, once per request. Backed by the database (`admin_role()` → active admins only), never by
 * anything the browser sends. Returns null for signed-out users, students, and disabled admins.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  if (!supabaseConfigured) return null;
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_role");
  let role: AdminRole | null = isAdminRole(data) ? data : null;
  // Before migration 0005 there are no roles yet: fall back to the old is_admin() check as a full admin.
  if (error && (error.code === "PGRST202" || error.code === "42883")) {
    const { data: legacy } = await supabase.rpc("is_admin");
    role = legacy === true ? "owner" : null;
  }
  if (!role) return null;
  return { supabase, user: { id: user.id, email: user.email }, role, can: (p) => can(role, p) };
});

/** For pages: the admin context if this admin holds `perm`, otherwise null (the admin template shows "no access"). */
export async function requirePermission(perm: Permission): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  return ctx && ctx.can(perm) ? ctx : null;
}

type DbError = { code?: string; message?: string } | null | undefined;

/** Turns database errors into messages a person can act on. Never leaks SQL. */
export function dbError(error: DbError, fallback = "That didn't save. Please try again."): ActionResult {
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "That value is already in use. Choose a different one (for example a different slug or code)." };
  if (error.code === "23503") return { ok: false, error: "That item is linked to something that no longer exists, or is still in use." };
  if (error.code === "23514") return { ok: false, error: "One of the values isn't allowed. Check the form and try again." };
  if (error.code === "42501" || /row-level security|not authorised/i.test(error.message ?? "")) return { ok: false, error: "You don't have permission to do that." };
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST202" || error.code === "PGRST205") {
    return { ok: false, error: "The database is missing part of the setup. Run the latest migration in supabase/migrations, then try again." };
  }
  return { ok: false, error: fallback };
}

function isRedirect(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

/**
 * Wraps every admin server action: re-authorises on the server for the permission the action needs, then runs, and
 * never throws raw errors at the UI. RLS enforces the same permission again in the database.
 */
export async function runAdmin(perm: Permission, fn: (ctx: AdminContext) => Promise<ActionResult>): Promise<ActionResult> {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.can(perm)) return { ok: false, error: "You don't have permission to do that." };
  try {
    return await fn(ctx);
  } catch (e) {
    if (isRedirect(e)) throw e;
    console.error("[admin action] unexpected error:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Something unexpected went wrong. Nothing was saved." };
  }
}
