import { cache } from "react";
import { contentClient } from "@/lib/cms";
import { supabaseConfigured } from "@/lib/supabase/server";
import { visitorCountry } from "@/lib/currency";
import { payableCurrencies } from "./paystack";
import { capKey, getUnsupported } from "./capabilities";
import { METHOD_LABELS, NIGERIA_ONLY, PROVIDERS, isMethod, isProviderId, type MethodId, type ProviderId } from "./providers";

/**
 * Which providers can take payment, per currency. A provider is offered for a currency only when ALL of these hold:
 *   - it is enabled and prioritised in Admin → Settings → Payments (payment_providers),
 *   - it is configured on the server (its secret key exists),
 *   - its documentation says it can process that currency (provider capability list),
 *   - the admin allowed that currency and at least one method for it,
 *   - the merchant account has NOT refused that currency (payment_provider_capabilities, learned from real answers),
 *   - local Nigerian rails (bank transfer, USSD, QR, OPay, bank account) only for buyers in Nigeria (or unknown country).
 * Lower priority number = offered first. The same function renders checkout AND re-checks the buyer's choice on the
 * server, so the browser can never pick something that isn't on this list.
 */
export type ProviderConfig = { id: ProviderId; enabled: boolean; priority: number; currencies: string[]; methods: MethodId[] };
export type MethodOption = { method: MethodId; label: string; provider: ProviderId };
export type ProviderOption = { provider: ProviderId; name: string; methods: MethodId[] };
export type PaymentOptions = { currencies: string[]; methods: Record<string, MethodOption[]>; providers: Record<string, ProviderOption[]> };

/** Pre-0009 databases: Paystack only, currencies from PAYSTACK_CURRENCIES, every Paystack method. */
function legacyConfig(): ProviderConfig[] {
  return [{ id: "paystack", enabled: true, priority: 10, currencies: payableCurrencies(), methods: [...(PROVIDERS.paystack.supports.NGN ?? []), "apple_pay"] }];
}

export const getProviderConfig = cache(async (): Promise<ProviderConfig[]> => {
  if (!supabaseConfigured) return legacyConfig();
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.from("payment_providers").select("id, enabled, priority, currencies, methods").order("priority");
    if (error || !data) return legacyConfig();
    return (data as Record<string, unknown>[]).filter((r) => isProviderId(r.id)).map((r) => ({
      id: r.id as ProviderId, enabled: r.enabled === true, priority: Number(r.priority) || 100,
      currencies: Array.isArray(r.currencies) ? (r.currencies as string[]) : [], methods: (Array.isArray(r.methods) ? (r.methods as string[]) : []).filter(isMethod),
    }));
  } catch {
    return legacyConfig();
  }
});

export function computeOptions(config: ProviderConfig[], country: string | null, unsupported: Set<string> = new Set()): PaymentOptions {
  const inNigeria = !country || country === "NG";
  const methods: Record<string, MethodOption[]> = {};
  const providers: Record<string, ProviderOption[]> = {};
  for (const cfg of [...config].sort((a, b) => a.priority - b.priority)) {
    const p = PROVIDERS[cfg.id];
    if (!cfg.enabled || !p.configured()) continue;
    for (const cur of cfg.currencies) {
      if (unsupported.has(capKey(cfg.id, p.mode(), cur))) continue; // the merchant account refused it
      const usable = (p.supports[cur] ?? []).filter((m) => cfg.methods.includes(m) && (inNigeria || !NIGERIA_ONLY.includes(m)));
      if (!usable.length) continue;
      (providers[cur] ??= []).push({ provider: cfg.id, name: p.name, methods: usable });
      const list = (methods[cur] ??= []);
      for (const m of usable) if (!list.some((x) => x.method === m)) list.push({ method: m, label: METHOD_LABELS[m], provider: cfg.id });
    }
  }
  // Card first, then the order above.
  for (const cur of Object.keys(methods)) methods[cur].sort((a, b) => (a.method === "card" ? -1 : b.method === "card" ? 1 : 0));
  return { currencies: Object.keys(providers).filter((c) => providers[c].length), methods, providers };
}

/** @deprecated use visitorCountry from lib/currency. */
export const buyerCountry = visitorCountry;

export async function getPaymentOptions(): Promise<PaymentOptions> {
  const [config, country, unsupported] = await Promise.all([getProviderConfig(), visitorCountry(), getUnsupported()]);
  return computeOptions(config, country, unsupported);
}

/**
 * Server-side choice of who processes a payment, in the order to try them: the buyer's chosen provider first (if it is
 * really on offer for this currency), then every other capable provider by priority. Empty = the currency can't be
 * paid right now.
 */
export function orderCandidates(o: PaymentOptions, currency: string, chosen: unknown): ProviderOption[] {
  const list = o.providers[currency] ?? [];
  const first = isProviderId(chosen) ? list.find((p) => p.provider === chosen) : undefined;
  return first ? [first, ...list.filter((p) => p !== first)] : list;
}

export async function resolveProviders(currency: string, chosen: unknown): Promise<ProviderOption[]> {
  return orderCandidates(await getPaymentOptions(), currency, chosen);
}

/** What the browser needs: per currency, the providers it may choose and the methods each offers (labels only). */
export type PublicPayment = { currencies: string[]; providers: Record<string, { id: ProviderId; name: string; methods: string[] }[]> };
export function publicPayment(o: PaymentOptions): PublicPayment {
  return {
    currencies: o.currencies,
    providers: Object.fromEntries(Object.entries(o.providers).map(([c, list]) => [c, list.map((p) => ({ id: p.provider, name: p.name, methods: p.methods.map((m) => METHOD_LABELS[m]) }))])),
  };
}
