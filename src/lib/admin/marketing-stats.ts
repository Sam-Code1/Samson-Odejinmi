import type { AdminContext } from "./guard";
import { formatMoneyMinor } from "./validation";

/** Shape returned by public.marketing_stats() (migration 0008). Every number comes from stored rows. */
export type MarketingStats = {
  can_see_revenue: boolean;
  orders: number; paid_orders: number; checkouts_started: number; checkouts_completed: number; customers: number; new_contacts: number; subscribers: number;
  revenue: Record<string, number> | null;
  product_sales: { name: string; type: string | null; currency: string; orders: number; revenue: number | null }[];
  coupons: { code: string; currency: string; uses: number; discount: number }[];
  affiliates: { clicks: number; orders: number; revenue: Record<string, number> | null; commission: { status: string; currency: string; amount: number }[] | null };
  email: { sent: number; failed: number; delivered: number; opened: number; clicked: number; bounced: number; unsubscribed: number };
  unsubscribes: number;
  sources: { source: string; currency: string; orders: number; revenue: number | null }[];
  first_sources: { source: string; orders: number }[];
  campaigns: { name: string; slug: string; orders: number; revenue: Record<string, number> | null; emails_sent: number }[];
};

export const PERIODS = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "365": "Last 12 months" } as const;
export const periodDays = (v: string | undefined) => (v && v in PERIODS ? Number(v) : 30);

export async function getMarketingStats(ctx: AdminContext, days: number): Promise<{ stats: MarketingStats | null; error: boolean }> {
  const to = new Date(Date.now() + 60_000);
  const from = new Date(to.getTime() - days * 86_400_000);
  const { data, error } = await ctx.supabase.rpc("marketing_stats", { p_from: from.toISOString(), p_to: to.toISOString() });
  return { stats: (data as MarketingStats) ?? null, error: !!error };
}

export const moneyMap = (m: Record<string, number> | null | undefined) =>
  m && Object.keys(m).length ? Object.entries(m).map(([c, v]) => formatMoneyMinor(Number(v), c)).join(" · ") : "0";

export const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : "–");
