"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { dbError, runAdmin, type AdminContext } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { EMAIL_RE, bool, isUuid, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { confirmPassword } from "@/lib/admin/stepup";
import { ROLE_LABELS } from "@/lib/admin/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { envSiteUrl } from "@/lib/site";

/**
 * Admin management. Owner only ("admins" permission), enforced here AND inside the database functions
 * (admin_upsert, admin_set_role, admin_set_status, admin_remove, admin_transfer_ownership), which also make it
 * impossible to create a second Owner or change the Owner's row.
 */
const ASSIGNABLE = ["super_admin", "academy_admin", "content_manager", "support"];

function refresh() {
  revalidatePath("/admin/admins");
  revalidatePath("/admin/activity");
}

function friendly(message: string | undefined): string {
  if (/no account/i.test(message ?? "")) return "No account uses that email yet. Tick “Send an invitation” to invite them, or ask them to register first.";
  if (/cannot change owner/i.test(message ?? "")) return "The Owner's access can't be changed here. Transfer ownership first.";
  if (/not an active admin/i.test(message ?? "")) return "Ownership can only go to an active admin.";
  if (/invalid role/i.test(message ?? "")) return "Choose a valid role.";
  return "That change couldn't be made.";
}

async function nameFor(ctx: AdminContext, userId: string) {
  const { data } = await ctx.supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
  return (data?.email as string) ?? userId;
}

export async function addAdmin(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("admins", async (ctx) => {
    const email = str(fd, "email", 200).toLowerCase();
    const role = str(fd, "role", 20);
    const errors: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
    if (!ASSIGNABLE.includes(role)) errors.role = "Choose a role.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    if (role === "super_admin") {
      const c = await confirmPassword(ctx, str(fd, "password", 200));
      if (!c.ok) return { ok: false, fieldErrors: { password: c.error } };
    }

    const { data: existing } = await ctx.supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    let invited = false;
    if (!existing) {
      if (!bool(fd, "invite")) return { ok: false, fieldErrors: { email: friendly("no account") } };
      const service = createServiceClient();
      if (!service) return { ok: false, error: "Invitations need SUPABASE_SERVICE_ROLE_KEY on the server. Ask them to register, then add them here." };
      const h = await headers();
      const base = envSiteUrl() ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
      const { error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${base}/auth/callback?next=/reset-password` });
      if (error) {
        console.error("[admins] invite failed:", error.status, error.message);
        return { ok: false, error: "The invitation couldn't be sent. Check Supabase Auth email settings and try again." };
      }
      invited = true;
    }
    const { data: uid, error } = await ctx.supabase.rpc("admin_upsert", { p_email: email, p_role: role });
    if (error) return { ok: false, error: friendly(error.message) };
    await logActivity(ctx, invited ? "admin invited" : "admin added", "admin", uid as string, email, { role });
    refresh();
    return { ok: true, message: invited ? `Invitation sent. ${email} is now ${ROLE_LABELS[role as keyof typeof ROLE_LABELS]}.` : `${email} is now ${ROLE_LABELS[role as keyof typeof ROLE_LABELS]}.` };
  });
}

export async function changeAdminRole(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("admins", async (ctx) => {
    const userId = str(fd, "userId", 40), role = str(fd, "role", 20);
    if (!isUuid(userId) || !ASSIGNABLE.includes(role)) return { ok: false, error: "Choose a valid role." };
    if (role === "super_admin") {
      const c = await confirmPassword(ctx, str(fd, "password", 200));
      if (!c.ok) return { ok: false, fieldErrors: { password: c.error } };
    }
    const { error } = await ctx.supabase.rpc("admin_set_role", { p_user: userId, p_role: role });
    if (error) return { ok: false, error: friendly(error.message) };
    await logActivity(ctx, "admin role changed", "admin", userId, await nameFor(ctx, userId), { role });
    refresh();
    return { ok: true, message: "Role updated." };
  });
}

export async function setAdminStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("admins", async (ctx) => {
    const userId = str(fd, "userId", 40), status = str(fd, "status", 10);
    if (!isUuid(userId) || !["active", "disabled"].includes(status)) return { ok: false, error: "That change isn't valid." };
    if (userId === ctx.user.id) return { ok: false, error: "You can't disable your own access." };
    const { error } = await ctx.supabase.rpc("admin_set_status", { p_user: userId, p_status: status });
    if (error) return { ok: false, error: friendly(error.message) };
    await logActivity(ctx, status === "disabled" ? "admin disabled" : "admin re-enabled", "admin", userId, await nameFor(ctx, userId));
    refresh();
    return { ok: true, message: status === "disabled" ? "Admin access disabled. It takes effect on their next request." : "Admin access restored." };
  });
}

export async function removeAdmin(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("admins", async (ctx) => {
    const userId = str(fd, "userId", 40);
    if (!isUuid(userId)) return { ok: false, error: "Missing admin." };
    if (userId === ctx.user.id) return { ok: false, error: "You can't remove yourself." };
    const c = await confirmPassword(ctx, str(fd, "password", 200));
    if (!c.ok) return { ok: false, fieldErrors: { password: c.error } };
    const label = await nameFor(ctx, userId);
    const { error } = await ctx.supabase.rpc("admin_remove", { p_user: userId });
    if (error) return { ok: false, error: friendly(error.message) };
    await logActivity(ctx, "admin removed", "admin", userId, label);
    refresh();
    return { ok: true, message: "Admin access removed. Their account and any student data are untouched." };
  });
}

export async function transferOwnership(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("admins", async (ctx) => {
    if (ctx.role !== "owner") return { ok: false, error: "Only the Owner can transfer ownership." };
    const userId = str(fd, "userId", 40);
    if (!isUuid(userId)) return { ok: false, fieldErrors: { userId: "Choose who becomes the Owner." } };
    if (str(fd, "confirm_text", 20) !== "TRANSFER") return { ok: false, fieldErrors: { confirm_text: "Type TRANSFER to confirm." } };
    const c = await confirmPassword(ctx, str(fd, "password", 200));
    if (!c.ok) return { ok: false, fieldErrors: { password: c.error } };
    const label = await nameFor(ctx, userId);
    const { error } = await ctx.supabase.rpc("admin_transfer_ownership", { p_user: userId });
    if (error) return dbError(error, friendly(error.message));
    await logActivity(ctx, "ownership transferred", "admin", userId, label);
    refresh();
    return { ok: true, message: `Ownership transferred to ${label}. You are now a Super Admin.` };
  });
}

