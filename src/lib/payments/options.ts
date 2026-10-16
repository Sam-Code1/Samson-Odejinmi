import { cache } from "react";
import { headers } from "next/headers";
import { contentClient } from "@/lib/cms";
import { supabaseConfigured } from "@/lib/supabase/server";
import { payableCurrencies } from "./paystack";
import { METHOD_LABELS, NIGERIA_ONLY, PROVIDERS, isMethod, isProviderId, type MethodId, type ProviderId } from "./providers";

/**
 * Payment method discovery. A method is offered only when ALL of these hold:
 *   - its provider is enabled and prioritised in Admin → Settings → Payments (payment_providers),
 *   - the provider is configured on the server (its secret key exists),
 *   - the provider can process that method in that currency (provider capability list),
 *   - the admin allowed that method and currency for the provider,
 *   - local Nigerian rails (bank transfer, USSD, QR, OPay, bank account) only for buyers in Nigeria (or unknown country).
 * If several providers can take the same method, the one with the lowest priority number wins.
 * The same function is used to render checkout AND to re-check the buyer's choice on the server.
 */
export type ProviderConfig = { id: ProviderId; enabled: boolean; priority: number; currencies: string[]; methods: MethodId[] };
export type MethodOption = { method: MethodId; label: string; provider: ProviderId };
export type PaymentOptions = { currencies: string[]; methods: Record<string, MethodOption[]> };

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

export function computeOptions(config: ProviderConfig[], country: string | null): PaymentOptions {
  const inNigeria = !country || country === "NG";
  const methods: Record<string, MethodOption[]> = {};
  for (const cfg of [...config].sort((a, b) => a.priority - b.priority)) {
    const p = PROVIDERS[cfg.id];
    if (!cfg.enabled || !p.configured()) continue;
    for (const cur of cfg.currencies) {
      for (const m of p.supports[cur] ?? []) {
        if (!cfg.methods.includes(m)) continue;
        if (!inNigeria && NIGERIA_ONLY.includes(m)) continue;
        const list = (methods[cur] ??= []);
        if (!list.some((x) => x.method === m)) list.push({ method: m, label: METHOD_LABELS[m], provider: cfg.id });
      }
    }
  }
  // Card first, then the order above.
  for (const cur of Object.keys(methods)) methods[cur].sort((a, b) => (a.method === "card" ? -1 : b.method === "card" ? 1 : 0));
  return { currencies: Object.keys(methods).filter((c) => methods[c].length), methods };
}

export async function buyerCountry(): Promise<string | null> {
  const c = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
}

export async function getPaymentOptions(): Promise<PaymentOptions> {
  return computeOptions(await getProviderConfig(), await buyerCountry());
}

/** Server-side re-check of what the browser asked for. */
export async function resolveMethod(currency: string, method: unknown): Promise<MethodOption | null> {
  const opts = await getPaymentOptions();
  const list = opts.methods[currency] ?? [];
  if (!isMethod(method)) return list[0] ?? null; // no choice sent: first available (card when offered)
  return list.find((o) => o.method === method) ?? null;
}

/** What the browser needs: method ids and labels per currency (which provider handles it stays on the server). */
export function publicMethods(o: PaymentOptions): Record<string, { method: string; label: string }[]> {
  return Object.fromEntries(Object.entries(o.methods).map(([c, list]) => [c, list.map(({ method, label }) => ({ method, label }))]));
}
