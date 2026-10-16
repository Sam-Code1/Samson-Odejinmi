"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { cleanTag } from "@/lib/marketing/steps";

/**
 * Customer records ("customers" permission: personal data). Staff can tag, annotate, give or remove access, and record
 * an unsubscribe request. Staff can never opt someone IN to marketing: consent only comes from the person themselves.
 */
const refresh = (id: string) => revalidatePath(`/admin/marketing/customers/${id}`);

export async function addContactTag(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40), tag = cleanTag(str(fd, "tag", 60));
    if (!isUuid(id)) return { ok: false, error: "Missing customer." };
    if (!tag) return { ok: false, fieldErrors: { tag: "Letters, numbers and dashes, e.g. vip or blender-2026." } };
    const { error } = await ctx.supabase.from("contact_tags").upsert({ contact_id: id, tag }, { onConflict: "contact_id,tag", ignoreDuplicates: true });
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message: `Tagged ${tag}.` };
  });
}

export async function removeContactTag(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40), tag = cleanTag(str(fd, "tag", 60));
    if (!isUuid(id) || !tag) return { ok: false, error: "Missing tag." };
    const { error } = await ctx.supabase.from("contact_tags").delete().eq("contact_id", id).eq("tag", tag);
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message: `Removed ${tag}.` };
  });
}

export async function addContactNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40), body = str(fd, "body", 4000);
    if (!isUuid(id)) return { ok: false, error: "Missing customer." };
    if (!body) return { ok: false, fieldErrors: { body: "Write the note." } };
    const { error } = await ctx.supabase.from("contact_notes").insert({ contact_id: id, body, author_id: ctx.user.id });
    if (error) return dbError(error);
    refresh(id);
    return { ok: true, message: "Note added." };
  });
}

export async function grantProductAccess(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40), productId = str(fd, "product_id", 40);
    if (!isUuid(id) || !isUuid(productId)) return { ok: false, fieldErrors: { product_id: "Choose a product." } };
    const { data: c } = await ctx.supabase.from("contacts").select("user_id, email").eq("id", id).maybeSingle();
    if (!c?.user_id) return { ok: false, error: "This person doesn't have an account yet, so access can't be attached. Ask them to sign up with this email first." };
    const { error } = await ctx.supabase.rpc("admin_grant_product", { p_user: c.user_id, p_product: productId });
    if (error) return dbError(error);
    const { data: p } = await ctx.supabase.from("products").select("name").eq("id", productId).maybeSingle();
    await logActivity(ctx, "customer access changed", "contact", id, c.email as string, { granted: (p?.name as string) ?? productId });
    refresh(id);
    return { ok: true, message: "Access granted. It's in their library now." };
  });
}

export async function revokeEntitlement(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40), ent = str(fd, "entitlementId", 40);
    if (!isUuid(id) || !isUuid(ent)) return { ok: false, error: "Missing access record." };
    const { error } = await ctx.supabase.rpc("admin_revoke_entitlement", { p_entitlement: ent });
    if (error) return dbError(error, "That access is already removed.");
    await logActivity(ctx, "customer access changed", "contact", id, null, { revoked: ent });
    refresh(id);
    return { ok: true, message: "Access removed. (Course access itself is managed under Enrolments.)" };
  });
}

/** On the person's request (e.g. by email). Never the other way round. */
export async function unsubscribeContact(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("customers", async (ctx) => {
    const id = str(fd, "contactId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing customer." };
    const { data, error } = await ctx.supabase.from("contacts").update({ marketing_consent: false, unsubscribed_at: new Date().toISOString() }).eq("id", id).select("email").maybeSingle();
    if (error || !data) return dbError(error);
    await ctx.supabase.from("automation_runs").update({ status: "cancelled", last_error: "unsubscribed by staff on request" }).eq("contact_id", id).in("status", ["active", "waiting"]);
    await logActivity(ctx, "contact unsubscribed", "contact", id, data.email as string);
    refresh(id);
    return { ok: true, message: "Unsubscribed from marketing email." };
  });
}
