import { cookies, headers } from "next/headers";
import type { Currency } from "@/content/course";

/**
 * The shopper's currency: ONE value used by every price and every checkout on the site.
 *   1. the currency the shopper chose (cookie, set by the currency selector; validated here, never trusted blindly)
 *   2. otherwise a regional default from the visitor's country: Nigeria → NGN, United Kingdom → GBP, elsewhere → USD.
 * The country is only a recommendation (VPNs, travel): the shopper can always change it.
 * Whether a currency can actually be PAID is a separate question answered by payment capabilities (lib/payments).
 */
export const CURRENCIES: Currency[] = ["NGN", "USD", "GBP"];
export const CURRENCY_COOKIE = "fa_currency";
export const CURRENCY_LABELS: Record<Currency, { symbol: string; name: string }> = {
  NGN: { symbol: "₦", name: "Naira" }, USD: { symbol: "$", name: "US dollar" }, GBP: { symbol: "£", name: "Pound sterling" },
};

export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as string[]).includes(v);

export function regionalCurrency(country: string | null | undefined): Currency {
  const c = country?.toUpperCase();
  return c === "NG" ? "NGN" : c === "GB" ? "GBP" : "USD";
}

export async function visitorCountry(): Promise<string | null> {
  const c = (await headers()).get("x-vercel-ip-country")?.toUpperCase() ?? null;
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
}

/** The currency to show and charge in, for this request. `chosen` = the shopper picked it themselves. */
export async function getShopperCurrency(): Promise<{ currency: Currency; chosen: boolean; country: string | null }> {
  const [jar, country] = await Promise.all([cookies(), visitorCountry()]);
  const saved = jar.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(saved)) return { currency: saved, chosen: true, country };
  return { currency: regionalCurrency(country), chosen: false, country };
}

/**
 * Of the currencies an item can be paid in, which one to use: the shopper's currency when possible, otherwise the
 * regional default, otherwise the first available. Returns null when nothing is available.
 */
export function pickCurrency<T extends string>(available: T[], preferred: string, country: string | null): T | null {
  if (available.includes(preferred as T)) return preferred as T;
  const regional = regionalCurrency(country);
  if (available.includes(regional as T)) return regional as T;
  return available[0] ?? null;
}
