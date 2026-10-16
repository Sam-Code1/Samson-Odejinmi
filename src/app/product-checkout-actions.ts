"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { readAttribution } from "@/lib/attribution-server";
import { checkoutMessage, cleanCode, cleanCurrency, startPayment } from "@/lib/checkout";
import { sendEmail, templates } from "@/lib/email";

/**
 * Product checkout (ebooks, guides, templates, downloads, bundles, course products). The browser sends only the
 * product, the currency and an optional coupon code. The database computes the price and discount
 * (product_checkout_quote / create_product_checkout); referral and UTM data come from our own httpOnly cookies and are
 * cleaned again by the database. Access is granted only after Paystack verification (or a server-side free checkout).
 */
export type ProductQuote = { ok: true; base: number; discount: number; total: number; currency: string; couponCode: string | null } | { ok: false; error: string };
export type ProductCheckoutState = { error?: string };

/**
 * Is the shop open (migration 0010)? Read fresh, not from the page cache, so closing the shop takes effect at once.
 * Before 0010 the function doesn't exist and the shop counts as open. The database also refuses product payments
 * while closed, so this is the friendly message, not the only guard.
 */
async function shopOpen(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("shop_is_open");
  return error ? true : data !== false;
}

export async function quoteProduct(productId: string, currency: string, code: string): Promise<ProductQuote> {
  if (!isUuid(productId)) return { ok: false, error: checkoutMessage("not_available") };
  if (!(await getUser())) return { ok: false, error: checkoutMessage("sign_in") };
  const supabase = await createClient();
  if (!(await shopOpen(supabase))) return { ok: false, error: checkoutMessage("shop_closed") };
  const { data, error } = await supabase.rpc("product_checkout_quote", { p_product: productId, p_currency: cleanCurrency(currency), p_code: cleanCode(code) || null });
  const q = data as { ok: boolean; error?: string; base: number; discount: number; total: number; currency: string; coupon_code: string | null } | null;
  if (error || !q) return { ok: false, error: checkoutMessage() };
  if (!q.ok) return { ok: false, error: checkoutMessage(q.error) };
  return { ok: true, base: q.base, discount: q.discount, total: q.total, currency: q.currency, couponCode: q.coupon_code };
}

export async function startProductCheckout(_: ProductCheckoutState, fd: FormData): Promise<ProductCheckoutState> {
  const productId = String(fd.get("productId") ?? "");
  const slug = String(fd.get("slug") ?? "").replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/academy/shop/${slug}`)}`);
  if (!isUuid(productId)) return { error: checkoutMessage("not_available") };

  const { ref, attribution } = await readAttribution();
  const supabase = await createClient();
  if (!(await shopOpen(supabase))) return { error: checkoutMessage("shop_closed") };
  const { data, error } = await supabase.rpc("create_product_checkout", {
    p_product: productId, p_currency: cleanCurrency(fd.get("currency")), p_code: cleanCode(fd.get("coupon")) || null, p_ref: ref, p_attribution: attribution,
  });
  const r = data as { ok: boolean; error?: string; free?: boolean; reference?: string; total?: number; currency?: string; email?: string; product_name?: string; product_type?: string; course_slug?: string | null } | null;
  if (error?.message?.includes("shop_closed")) return { error: checkoutMessage("shop_closed") };
  if (error || !r) { console.error("[checkout] create_product_checkout:", error?.code, error?.message); return { error: checkoutMessage() }; }
  if (!r.ok) return { error: checkoutMessage(r.error) };

  if (r.free) {
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
    if (user.email) await sendEmail({ to: user.email, ...templates.productAccess({ name: (p?.first_name as string) ?? "", product: r.product_name ?? "your purchase", courseSlug: r.course_slug ?? null }) });
    revalidatePath("/library");
    redirect(r.product_type === "course" && r.course_slug ? `/learn/${r.course_slug}` : "/library");
  }

  const started = await startPayment(supabase, { email: r.email ?? user.email ?? "", total: r.total ?? 0, currency: r.currency ?? "NGN", reference: r.reference!, metadata: { product_id: productId, user_id: user.id }, method: fd.get("method") });
  if ("error" in started) {
    await supabase.rpc("cancel_my_pending_payment", { p_reference: r.reference });
    return { error: started.error };
  }
  redirect(started.url);
}
