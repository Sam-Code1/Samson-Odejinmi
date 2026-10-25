import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { contentClient } from "@/lib/cms";
import { formatMoney } from "@/lib/utils";

export type AffiliateSummary = {
  code: string; status: "pending" | "active" | "suspended" | "rejected"; rate_bps: number; payout_details: string | null; created_at: string;
  clicks_total: number; clicks_30d: number; conversions: number; sales: Record<string, number>;
  commission: { status: string; currency: string; amount: number }[];
  recent: { created_at: string; amount: number; currency: string; status: string; rate_bps?: number; items?: string | null }[];
  /** Migration 0019. */
  top_pages?: { path: string; clicks: number }[];
};

/** One thing an affiliate can promote, and what it pays (migration 0019; [] before it runs). */
export type AffiliateOffer = { name: string; type: string; slug: string; course_slug: string | null; cover: string | null; rate_bps: number };

/** The signed-in person's own affiliate numbers; null when they haven't applied. `unavailable` = the programme isn't set up in the database. */
export const getMyAffiliate = cache(async (): Promise<{ summary: AffiliateSummary | null; unavailable: boolean }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_affiliate_summary");
  if (error) return { summary: null, unavailable: true };
  return { summary: (data as AffiliateSummary | null) ?? null, unavailable: false };
});

/** Page path for an offer: books and files under /academy/books, courses under /academy/courses. */
export const offerPath = (o: Pick<AffiliateOffer, "type" | "slug" | "course_slug">) =>
  o.type === "course" && o.course_slug ? `/academy/courses/${o.course_slug}` : `/academy/books/${o.slug}`;

/** The programme's rate card as the signed-in affiliate sees it (their own rate where a product has none). */
export const getOffers = cache(async (): Promise<AffiliateOffer[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("affiliate_offers");
    return error || !Array.isArray(data) ? [] : (data as AffiliateOffer[]);
  } catch { return []; }
});

/** The same rate card for visitors (no cookies, so the public page stays cacheable). */
export const getPublicOffers = cache(async (): Promise<AffiliateOffer[]> => {
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.rpc("affiliate_offers");
    return error || !Array.isArray(data) ? [] : (data as AffiliateOffer[]);
  } catch { return []; }
});

export const pct = (bps: number) => `${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(1)}%`;

export const money = (m: Record<string, number>) => (Object.keys(m).length ? Object.entries(m).map(([c, v]) => formatMoney(v, c)).join(" · ") : "0");

export function byStatus(s: AffiliateSummary, st: string) {
  const m: Record<string, number> = {};
  s.commission.filter((c) => c.status === st).forEach((c) => { m[c.currency] = (m[c.currency] ?? 0) + Number(c.amount); });
  return money(m);
}
