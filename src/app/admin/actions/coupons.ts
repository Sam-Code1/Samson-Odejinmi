"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, isUuid, optStr, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";

/**
 * Coupons ("coupons" permission). Only the definition lives here: the discount is always computed by the database
 * (checkout_quote) at checkout and again at fulfilment, never taken from the browser.
 */
const CURRENCIES = ["NGN", "USD", "GBP"];

function money(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n * 100) : NaN;
}

function date(v: string): string | null | "invalid" {
  if (!v) return null;
  // datetime-local has no timezone: coupon times are always UTC (the form says so).
  const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00Z` : v);
  return Number.isNaN(+d) ? "invalid" : d.toISOString();
}

function parse(fd: FormData) {
  const e: Record<string, string> = {};
  const code = str(fd, "code", 40).toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) e.code = "3–32 characters: letters, numbers, - or _.";
  const type = str(fd, "discount_type", 20);
  if (!["percentage", "fixed_amount"].includes(type)) e.discount_type = "Choose a discount type.";
  const currency = str(fd, "currency", 3).toUpperCase() || null;
  if (currency && !CURRENCIES.includes(currency)) e.currency = "Choose a currency.";
  let value = 0;
  if (type === "percentage") {
    value = Number(str(fd, "discount_value", 10));
    if (!Number.isInteger(value) || value < 1 || value > 100) e.discount_value = "Enter a whole percentage from 1 to 100.";
  } else {
    const m = money(str(fd, "discount_value", 20));
    if (m === null || Number.isNaN(m) || m <= 0) e.discount_value = "Enter the amount off, e.g. 5000.";
    else value = m;
    if (!currency) e.currency = "A fixed discount needs a currency.";
  }
  const min = money(str(fd, "min_amount", 20));
  if (Number.isNaN(min)) e.min_amount = "Enter a valid amount, or leave empty.";
  if (min !== null && !Number.isNaN(min) && !currency) e.currency = "A minimum purchase needs a currency.";
  const starts = date(str(fd, "starts_at", 40)), expires = date(str(fd, "expires_at", 40));
  if (starts === "invalid") e.starts_at = "Enter a valid date.";
  if (expires === "invalid") e.expires_at = "Enter a valid date.";
  if (starts && expires && starts !== "invalid" && expires !== "invalid" && starts >= expires) e.expires_at = "The expiry must be after the start.";
  const limitOf = (k: string) => {
    const v = str(fd, k, 8);
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) { e[k] = "Enter a whole number of 1 or more, or leave empty for no limit."; return null; }
    return n;
  };
  const usage_limit = limitOf("usage_limit"), per_user_limit = limitOf("per_user_limit");
  const appliesToAll = str(fd, "applies", 10) !== "selected";
  const courseIds = fd.getAll("course_ids").map(String).filter(isUuid).slice(0, 100);
  if (!appliesToAll && !courseIds.length) e.course_ids = "Choose at least one course, or apply it to all courses.";
  return {
    errors: e,
    row: {
      code, description: optStr(fd, "description", 300), discount_type: type, discount_value: value, currency,
      min_amount_minor: min !== null && !Number.isNaN(min) ? min : null, starts_at: starts === "invalid" ? null : starts, expires_at: expires === "invalid" ? null : expires,
      usage_limit, per_user_limit, applies_to_all: appliesToAll, active: bool(fd, "active"),
    },
    courseIds: appliesToAll ? [] : courseIds,
  };
}

export async function saveCoupon(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("coupons", async (ctx) => {
    const id = str(fd, "couponId", 40);
    const { errors, row, courseIds } = parse(fd);
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

    let couponId = id;
    if (isUuid(id)) {
      const { error } = await ctx.supabase.from("coupons").update(row).eq("id", id);
      if (error?.code === "23505") return { ok: false, fieldErrors: { code: "Another coupon already uses that code." } };
      if (error) return dbError(error);
    } else {
      const { data, error } = await ctx.supabase.from("coupons").insert({ ...row, created_by: ctx.user.id }).select("id").single();
      if (error?.code === "23505") return { ok: false, fieldErrors: { code: "Another coupon already uses that code." } };
      if (error || !data) return dbError(error);
      couponId = data.id as string;
    }
    await ctx.supabase.from("coupon_courses").delete().eq("coupon_id", couponId);
    if (courseIds.length) {
      const { error } = await ctx.supabase.from("coupon_courses").insert(courseIds.map((c) => ({ coupon_id: couponId, course_id: c })));
      if (error) return dbError(error);
    }
    await logActivity(ctx, isUuid(id) ? "coupon updated" : "coupon created", "coupon", couponId, row.code,
      { type: row.discount_type, value: row.discount_value, currency: row.currency });
    revalidatePath("/admin/coupons");
    if (!isUuid(id)) redirect(`/admin/coupons/${couponId}`);
    revalidatePath(`/admin/coupons/${couponId}`);
    return { ok: true, message: "Coupon saved." };
  });
}

export async function setCouponActive(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("coupons", async (ctx) => {
    const id = str(fd, "couponId", 40), on = str(fd, "on", 5) === "yes";
    if (!isUuid(id)) return { ok: false, error: "Missing coupon." };
    const { data, error } = await ctx.supabase.from("coupons").update({ active: on }).eq("id", id).select("code").single();
    if (error || !data) return dbError(error);
    await logActivity(ctx, on ? "coupon enabled" : "coupon disabled", "coupon", id, data.code as string);
    revalidatePath("/admin/coupons");
    revalidatePath(`/admin/coupons/${id}`);
    return { ok: true, message: on ? "Coupon enabled." : "Coupon disabled. It can't be used at checkout." };
  });
}

/** Coupons that have been used are kept (financial history); they can be disabled instead. */
export async function deleteCoupon(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("coupons", async (ctx) => {
    const id = str(fd, "couponId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing coupon." };
    const { count } = await ctx.supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", id);
    if (count) return { ok: false, error: "This coupon has been used, so it's kept for your records. Disable it instead." };
    const { data } = await ctx.supabase.from("coupons").select("code").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("coupons").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "coupon deleted", "coupon", id, (data?.code as string) ?? null);
    revalidatePath("/admin/coupons");
    redirect("/admin/coupons");
  });
}
