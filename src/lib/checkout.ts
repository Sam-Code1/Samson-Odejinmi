import { headers } from "next/headers";
import { PROVIDERS } from "@/lib/payments/providers";
import { resolveMethod } from "@/lib/payments/options";

/** Plain-language messages for the database's checkout error codes (courses and products). */
const MESSAGES: Record<string, string> = {
  sign_in: "Please sign in to continue.",
  not_available: "This isn't available to buy right now.",
  already_enrolled: "You're already enrolled in this course.",
  already_owned: "You already have this. Find it in your library.",
  no_price: "This isn't on sale in that currency.",
  coupon_invalid: "That coupon code isn't valid.",
  coupon_not_started: "That coupon isn't active yet.",
  coupon_expired: "That coupon has expired.",
  coupon_not_applicable: "That coupon can't be used for this.",
  coupon_currency: "That coupon only works in a different currency.",
  coupon_minimum: "This purchase doesn't meet that coupon's minimum.",
  coupon_used_up: "That coupon has reached its usage limit.",
  coupon_already_used: "You've already used that coupon.",
  shop_closed: "The shop is closed for now, so nothing can be bought here. Please check back soon.",
  too_many: "Too many checkout attempts. Please wait a while and try again.",
};
export const checkoutMessage = (code?: string) => MESSAGES[code ?? ""] ?? "We couldn't start checkout. Please try again.";
export const cleanCode = (v: unknown) => String(v ?? "").trim().toUpperCase().slice(0, 32);
export const cleanCurrency = (v: unknown) => String(v ?? "").trim().toUpperCase().slice(0, 3);

export async function siteBaseUrl() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> };

/**
 * Starts the hosted payment for a pending payment created by the database. The buyer's method is re-checked on the
 * server (resolveMethod); the chosen provider and method are recorded on the payment (set_payment_provider, own
 * pending payment only) so verification later asks the right provider. Returns the provider's checkout URL.
 */
export async function startPayment(supabase: Rpc, o: { email: string; total: number; currency: string; reference: string; metadata: Record<string, string>; method: unknown }): Promise<{ url: string } | { error: string }> {
  const opt = await resolveMethod(o.currency, o.method);
  if (!opt) return { error: "That payment method isn't available for this currency. Choose another." };
  const { data, error } = await supabase.rpc("set_payment_provider", { p_reference: o.reference, p_provider: opt.provider, p_method: opt.method });
  // Before migration 0009 the function doesn't exist; Paystack (the default provider on the row) still works.
  const legacyOk = error?.code === "PGRST202" && opt.provider === "paystack";
  if (!legacyOk && (error || data !== true)) return { error: "Your payment could not be started. Please try again in a moment." };
  const base = await siteBaseUrl();
  const url = await PROVIDERS[opt.provider].initialize({
    email: o.email, amountMinor: o.total, currency: o.currency, reference: o.reference, methods: [opt.method],
    callbackUrl: `${base}/academy/checkout/callback?reference=${encodeURIComponent(o.reference)}`,
    metadata: { ...o.metadata, reference: o.reference },
  });
  return url ? { url } : { error: "Your payment could not be started. Please try again in a moment." };
}
