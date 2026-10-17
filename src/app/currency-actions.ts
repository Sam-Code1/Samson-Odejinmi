"use server";

import { cookies } from "next/headers";
import { CURRENCY_COOKIE, isCurrency } from "@/lib/currency";

/**
 * Remembers the shopper's chosen currency for this browser (overrides the regional default). Only NGN/USD/GBP are
 * accepted. This is a display preference: every checkout re-prices on the server in the currency it is given and
 * re-checks that a provider can take it.
 */
export async function setShopperCurrency(currency: string): Promise<{ ok: boolean }> {
  if (!isCurrency(currency)) return { ok: false };
  (await cookies()).set(CURRENCY_COOKIE, currency, { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return { ok: true };
}
