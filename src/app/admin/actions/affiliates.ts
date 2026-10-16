"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, optStr, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";

/**
 * Affiliates ("affiliates" permission). Commission amounts are calculated by the database at payment verification and
 * are never edited here; staff only move a commission through pending → approved → paid (or cancel it).
 */
const AFF_STATUS = ["pending", "active", "suspended", "rejected"];
const NEXT: Record<string, string[]> = { pending: ["approved", "cancelled"], approved: ["paid", "cancelled"], paid: [], cancelled: [] };

export async function saveAffiliate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("affiliates", async (ctx) => {
    const id = str(fd, "affiliateId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing affiliate." };
    const status = str(fd, "status", 12);
    const pct = Number(str(fd, "rate", 6));
    const errors: Record<string, string> = {};
    if (!AFF_STATUS.includes(status)) errors.status = "Choose a status.";
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) errors.rate = "Enter a percentage between 0 and 90.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { data: before } = await ctx.supabase.from("affiliates").select("status, commission_rate_bps, code, approved_at").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That affiliate no longer exists." };
    const bps = Math.round(pct * 100);
    const { error } = await ctx.supabase.from("affiliates").update({
      status, commission_rate_bps: bps, notes: optStr(fd, "notes", 2000),
      ...(status === "active" && !before.approved_at ? { approved_at: new Date().toISOString(), approved_by: ctx.user.id } : {}),
    }).eq("id", id);
    if (error) return dbError(error);
    if (before.status !== status) await logActivity(ctx, "affiliate status changed", "affiliate", id, before.code as string, { from: before.status as string, to: status });
    if (before.commission_rate_bps !== bps) await logActivity(ctx, "affiliate rate changed", "affiliate", id, before.code as string, { from_bps: before.commission_rate_bps as number, to_bps: bps });
    revalidatePath(`/admin/marketing/affiliates/${id}`);
    revalidatePath("/admin/marketing/affiliates");
    return { ok: true, message: "Saved. Rate changes apply to future sales only." };
  });
}

export async function setCommissionStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("affiliates", async (ctx) => {
    const id = str(fd, "commissionId", 40), to = str(fd, "status", 12);
    if (!isUuid(id)) return { ok: false, error: "Missing commission." };
    const { data: c } = await ctx.supabase.from("affiliate_commissions").select("status, affiliate_id, amount_minor, currency").eq("id", id).maybeSingle();
    if (!c) return { ok: false, error: "That commission no longer exists." };
    if (!NEXT[c.status as string]?.includes(to)) return { ok: false, error: `A ${c.status} commission can't become ${to}.` };
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("affiliate_commissions").update({
      status: to, ...(to === "approved" ? { approved_at: now } : to === "paid" ? { paid_at: now } : { cancelled_at: now }), status_note: optStr(fd, "note", 300),
    }).eq("id", id).eq("status", c.status as string);
    if (error) return dbError(error);
    await logActivity(ctx, `commission ${to}`, "affiliate_commission", id, null, { amount_minor: c.amount_minor as number, currency: c.currency as string });
    revalidatePath(`/admin/marketing/affiliates/${c.affiliate_id}`);
    return { ok: true, message: to === "paid" ? "Marked as paid. Pay the affiliate outside the app (bank transfer)." : `Commission ${to}.` };
  });
}
