import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { PeriodFilter, ShareBar } from "@/components/admin/PeriodFilter";
import { requirePermission } from "@/lib/admin/guard";
import { getMarketingStats, moneyMap, periodDays } from "@/lib/admin/marketing-stats";
import { first } from "@/lib/admin/validation";

export const metadata = { title: "Attribution" };

export default async function AttributionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const days = periodDays(first((await searchParams).days));
  const { stats: s, error } = await getMarketingStats(ctx, days);

  // Sources can repeat per currency; combine orders per source for the bars.
  const last = new Map<string, { orders: number; revenue: Record<string, number> }>();
  (s?.sources ?? []).forEach((r) => {
    const m = last.get(r.source) ?? { orders: 0, revenue: {} };
    m.orders += r.orders;
    if (r.revenue != null) m.revenue[r.currency] = (m.revenue[r.currency] ?? 0) + r.revenue;
    last.set(r.source, m);
  });
  const lastRows = [...last].sort((a, b) => b[1].orders - a[1].orders);
  const firstRows = s?.first_sources ?? [];

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Attribution"
        subtitle="Where buyers came from, using UTM tags and affiliate links on the links you share. First touch = the first tagged link a buyer used; last touch = the most recent one before buying. Untagged visits count as direct." />
      <div className="mb-6"><PeriodFilter current={days} basePath="/admin/marketing/attribution" /></div>
      {error || !s ? <AdminError title="Attribution needs the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <div className="grid gap-8 lg:grid-cols-2">
          <Panel title="Last touch" description="The source of the last tagged link before purchase.">
            {lastRows.length === 0 ? <p className="text-body-sm text-ink-3">No orders in this period.</p> : (
              <ul className="space-y-4">{lastRows.map(([src, v]) => (
                <li key={src}>
                  <p className="mb-1.5 flex justify-between gap-3 text-body-sm"><span className="capitalize">{src}</span>{s.can_see_revenue && <span className="tabular-nums text-ink-3">{moneyMap(v.revenue)}</span>}</p>
                  <ShareBar value={v.orders} max={lastRows[0][1].orders} label={`${v.orders} order${v.orders === 1 ? "" : "s"}`} />
                </li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="First touch" description="How buyers first found you.">
            {firstRows.length === 0 ? <p className="text-body-sm text-ink-3">No orders in this period.</p> : (
              <ul className="space-y-4">{firstRows.map((r) => (
                <li key={r.source}>
                  <p className="mb-1.5 text-body-sm capitalize">{r.source}</p>
                  <ShareBar value={r.orders} max={firstRows[0].orders} label={`${r.orders} order${r.orders === 1 ? "" : "s"}`} />
                </li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="How to tag links" className="lg:col-span-2">
            <div className="space-y-3 text-body-sm text-ink-2">
              <p>Add UTM parameters to every link you post, e.g. <code className="break-all rounded bg-surface px-1.5 py-0.5">https://yourdomain.com/academy/shop/before-you-open-blender?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=blender-launch</code></p>
              <p>Campaigns → a post builds this link for you. Affiliate links (<code>?ref=code</code>) are attributed automatically.</p>
              <p className="text-caption text-ink-3">Only the campaign parameters are stored, in first-party cookies, and only when someone arrives through a tagged link: no IP addresses, no tracking pixels on the site, no third-party cookies.</p>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
