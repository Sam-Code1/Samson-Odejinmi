"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { startPayment } from "@/lib/checkout";
import { sendEmail, templates } from "@/lib/email";
import { readAttribution } from "@/lib/attribution-server";

/**
 * Course checkout. The browser sends only: which course, which currency, and an optional coupon code.
 * Prices and discounts come from the database (checkout_quote / create_checkout). Access is granted only after
 * Paystack verification (webhook or return page), never by this action.
 */
export type Quote = { ok: true; base: number; discount: number; total: number; currency: string; couponCode: string | null } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  sign_in: "Please sign in to continue.",
  not_available: "This course isn't available to buy right now.",
  already_enrolled: "You're already enrolled in this course.",
  no_price: "This course isn't on sale in that currency.",
  coupon_invalid: "That coupon code isn't valid.",
  coupon_not_started: "That coupon isn't active yet.",
  coupon_expired: "That coupon has expired.",
  coupon_not_applicable: "That coupon can't be used for this course.",
  coupon_currency: "That coupon only works in a different currency.",
  coupon_minimum: "This purchase doesn't meet that coupon's minimum.",
  coupon_used_up: "That coupon has reached its usage limit.",
  coupon_already_used: "You've already used that coupon.",
  too_many: "Too many checkout attempts. Please wait a while and try again.",
};
const message = (code?: string) => MESSAGES[code ?? ""] ?? "We couldn't start checkout. Please try again.";
const cleanCode = (v: unknown) => String(v ?? "").trim().toUpperCase().slice(0, 32);
const cleanCurrency = (v: unknown) => String(v ?? "").trim().toUpperCase().slice(0, 3);

export async function quoteCheckout(courseId: string, currency: string, code: string): Promise<Quote> {
  if (!isUuid(courseId)) return { ok: false, error: message("not_available") };
  const user = await getUser();
  if (!user) return { ok: false, error: message("sign_in") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkout_quote", { p_course: courseId, p_currency: cleanCurrency(currency), p_code: cleanCode(code) || null });
  const q = data as { ok: boolean; error?: string; base: number; discount: number; total: number; currency: string; coupon_code: string | null } | null;
  if (error || !q) return { ok: false, error: message() };
  if (!q.ok) return { ok: false, error: message(q.error) };
  return { ok: true, base: q.base, discount: q.discount, total: q.total, currency: q.currency, couponCode: q.coupon_code };
}

export type CheckoutState = { error?: string };

export async function startCheckout(_: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const courseId = String(fd.get("courseId") ?? "");
  const slug = String(fd.get("slug") ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const currency = cleanCurrency(fd.get("currency"));
  const code = cleanCode(fd.get("coupon"));
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/academy/courses/${slug}`)}`);
  if (!isUuid(courseId)) return { error: message("not_available") };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_checkout", { p_course: courseId, p_currency: currency, p_code: code || null });
  const r = data as { ok: boolean; error?: string; free?: boolean; reference?: string; total?: number; currency?: string; email?: string; course_title?: string } | null;
  if (error || !r) { console.error("[checkout] create_checkout:", error?.code, error?.message); return { error: message() }; }
  if (!r.ok) return { error: message(r.error) };

  // Referral + UTM data (our own httpOnly cookies, cleaned again by the database). Best effort: never blocks checkout.
  if (!r.free && r.reference) {
    const { ref, attribution } = await readAttribution();
    if (ref || attribution.first || attribution.last) {
      const { error: ae } = await supabase.rpc("attach_checkout_attribution", { p_reference: r.reference, p_ref: ref, p_attribution: attribution });
      if (ae && ae.code !== "PGRST202") console.warn("[checkout] attribution not attached:", ae.code);
    }
  }

  if (r.free) {
    // Enrolled by the database (free price or 100% coupon). Confirmation email is best-effort.
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
    if (user.email) await sendEmail({ to: user.email, ...templates.enrolment({ name: (p?.first_name as string) ?? "", course: r.course_title ?? "your course", slug }) });
    revalidatePath("/dashboard");
    redirect(`/learn/${slug}`);
  }

  const started = await startPayment(supabase, { email: r.email ?? user.email ?? "", total: r.total ?? 0, currency: r.currency ?? "NGN", reference: r.reference!, metadata: { course_id: courseId, user_id: user.id }, method: fd.get("method") });
  if ("error" in started) {
    await supabase.rpc("cancel_my_pending_payment", { p_reference: r.reference });
    return { error: started.error };
  }
  redirect(started.url);
}
