import { headers } from "next/headers";
import { PROVIDERS } from "@/lib/payments/providers";
import { getPaymentOptions, orderCandidates } from "@/lib/payments/options";
import { recordCapability } from "@/lib/payments/capabilities";

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
  currency_unavailable: "This currency is currently unavailable for payment. Please choose another currency.",
  provider_unavailable: "This payment provider is temporarily unavailable. Please choose another method or try again in a moment.",
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

/** Why a payment couldn't start. `alternatives` = currencies that CAN be paid right now (the caller filters by price). */
export type StartFailure = { error: string; code: "currency_unavailable" | "provider_unavailable" | "failed"; alternatives: string[] };

/**
 * Starts the hosted payment for a pending payment the database created. The currency is the one LOCKED on that payment
 * (the database priced it); it is never changed here. Providers are tried in order: the buyer's choice first (only if
 * it is really on offer), then every other provider that can take this currency.
 *   - A provider that refuses the currency (merchant account can't take it) is recorded as unsupported and skipped
 *     from then on; the next capable provider is tried.
 *   - Before each attempt the chosen provider and method are recorded on the payment (set_payment_provider, own
 *     pending payment only), so verification later asks the right provider.
 * Nothing is ever sent to a provider for a currency it isn't offered for.
 */
export async function startPayment(supabase: Rpc, o: { email: string; total: number; currency: string; reference: string; metadata: Record<string, string>; provider: unknown }): Promise<{ url: string } | StartFailure> {
  const opts = await getPaymentOptions();
  const alternatives = opts.currencies.filter((c) => c !== o.currency);
  const candidates = orderCandidates(opts, o.currency, o.provider);
  if (!candidates.length) return { error: checkoutMessage("currency_unavailable"), code: "currency_unavailable", alternatives };

  const base = await siteBaseUrl();
  let refused = 0;
  for (const c of candidates) {
    const { data, error } = await supabase.rpc("set_payment_provider", { p_reference: o.reference, p_provider: c.provider, p_method: c.methods[0] });
    // Before migration 0009 the function doesn't exist; Paystack (the default provider on the row) still works.
    const legacyOk = error?.code === "PGRST202" && c.provider === "paystack";
    if (!legacyOk && (error || data !== true)) continue;
    const res = await PROVIDERS[c.provider].initialize({
      email: o.email, amountMinor: o.total, currency: o.currency, reference: o.reference, methods: c.methods,
      callbackUrl: `${base}/academy/checkout/callback?reference=${encodeURIComponent(o.reference)}`,
      metadata: { ...o.metadata, reference: o.reference },
    });
    if (res.ok) {
      await recordCapability(c.provider, PROVIDERS[c.provider].mode(), o.currency, "supported");
      return { url: res.url };
    }
    if (res.reason === "unsupported_currency") {
      refused++;
      await recordCapability(c.provider, PROVIDERS[c.provider].mode(), o.currency, "unsupported", res.detail);
    }
  }
  // Every provider refused this currency (now recorded, so it won't be offered again): suggest the payable ones.
  if (refused === candidates.length) return { error: checkoutMessage("currency_unavailable"), code: "currency_unavailable", alternatives };
  return { error: checkoutMessage("provider_unavailable"), code: "provider_unavailable", alternatives };
}
