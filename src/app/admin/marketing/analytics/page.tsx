import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { AdminError } from "@/components/admin/AdminStates";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { requirePermission } from "@/lib/admin/guard";
import { getMarketingStats, moneyMap, pct, periodDays, type MarketingStats } from "@/lib/admin/marketing-stats";
import { first } from "@/lib/admin/validation";

export const metadata = { title: "Marketing analytics" };
type Sale = MarketingStats["product_sales"][number];
type Coupon = MarketingStats["coupons"][number];
type Camp = MarketingStats["campaigns"][number];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const days = periodDays(first((await searchParams).days));
  const { stats: s, error } = await getMarketingStats(ctx, days);
  if (error || !s) return <><PageHeader eyebrow="Sales & marketing" title="Analytics" /><AdminError title="Analytics need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /></>;
  const e = s.email;

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Analytics" subtitle="Product sales, coupons, email and campaign performance, from stored records only. Email delivery, opens and clicks appear only when the provider reports them." />
      <div className="mb-6"><PeriodFilter current={days} basePath="/admin/marketing/analytics" /></div>

      <h2 className="mb-4 text-admin-section">Sales</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {s.can_see_revenue && <StatCard label="Revenue" value={moneyMap(s.revenue)} />}
        <StatCard label="Orders" value={s.orders} />
        <StatCard label="Checkouts started" value={s.checkouts_started} />
        <StatCard label="Conversion" value={pct(s.checkouts_completed, s.checkouts_started)} />
      </div>
      <div className="mt-6">
        <DataTable<Sale> rows={s.product_sales} rowKey={(r) => `${r.name}-${r.currency}`} empty={{ title: "No sales in this period" }}
          columns={[
            { key: "n", header: "Product", primary: true, cell: (r) => r.name },
            { key: "t", header: "Type", cell: (r) => <span className="capitalize">{r.type ?? "–"}</span> },
            { key: "o", header: "Orders", className: "tabular-nums", cell: (r) => r.orders },
            ...(s.can_see_revenue ? [{ key: "r", header: "Revenue", className: "tabular-nums", cell: (r: Sale) => moneyMap({ [r.currency]: r.revenue ?? 0 }) }] : []),
          ]} />
      </div>

      <h2 className="mb-4 mt-12 text-admin-section">Email</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sent" value={e.sent} hint={e.failed ? `${e.failed} failed` : undefined} />
        <StatCard label="Delivered" value={e.delivered} hint={pct(e.delivered, e.sent)} />
        <StatCard label="Opened" value={e.opened} hint={pct(e.opened, e.sent)} />
        <StatCard label="Clicked" value={e.clicked} hint={pct(e.clicked, e.sent)} />
        <StatCard label="Bounced" value={e.bounced} />
        <StatCard label="Unsubscribed" value={s.unsubscribes} hint={`${e.unsubscribed} from an email link`} />
        <StatCard label="Subscribers now" value={s.subscribers} />
      </div>

      <h2 className="mb-4 mt-12 text-admin-section">Coupons</h2>
      <DataTable<Coupon> rows={s.coupons} rowKey={(r) => `${r.code}-${r.currency}`} empty={{ title: "No coupons used in this period" }}
        columns={[
          { key: "c", header: "Code", primary: true, cell: (r) => <span className="font-semibold tracking-wide">{r.code}</span> },
          { key: "u", header: "Uses", className: "tabular-nums", cell: (r) => r.uses },
          { key: "d", header: "Discount given", className: "tabular-nums", cell: (r) => moneyMap({ [r.currency]: r.discount }) },
        ]} />

      <h2 className="mb-4 mt-12 text-admin-section">Campaigns</h2>
      <DataTable<Camp> rows={s.campaigns} rowKey={(r) => r.slug} empty={{ title: "No campaigns yet", body: "Create one under Campaigns. Orders count when the buyer arrived with its utm_campaign, or used one of its coupons.", action: { href: "/admin/marketing/campaigns", label: "Campaigns" } }}
        columns={[
          { key: "n", header: "Campaign", primary: true, cell: (r) => <div><p>{r.name}</p><p className="text-caption text-ink-3">utm_campaign={r.slug}</p></div> },
          { key: "o", header: "Orders", className: "tabular-nums", cell: (r) => r.orders },
          ...(s.can_see_revenue ? [{ key: "r", header: "Revenue", className: "tabular-nums", cell: (r: Camp) => moneyMap(r.revenue) }] : []),
          { key: "e", header: "Emails sent", className: "tabular-nums", cell: (r) => r.emails_sent },
        ]} />

      <Panel title="Affiliates" className="mt-12">
        <dl className="grid grid-cols-2 gap-4 text-body-sm sm:grid-cols-4">
          <div><dt className="text-caption text-ink-3">Referral clicks</dt><dd className="mt-1 text-h4 tabular-nums">{s.affiliates.clicks}</dd></div>
          <div><dt className="text-caption text-ink-3">Referred orders</dt><dd className="mt-1 text-h4 tabular-nums">{s.affiliates.orders}</dd></div>
          {s.can_see_revenue && <div><dt className="text-caption text-ink-3">Referred revenue</dt><dd className="mt-1 text-h4 tabular-nums">{moneyMap(s.affiliates.revenue)}</dd></div>}
          {s.can_see_revenue && <div><dt className="text-caption text-ink-3">Commission (all statuses)</dt><dd className="mt-1 text-h4 tabular-nums">{moneyMap(Object.fromEntries((s.affiliates.commission ?? []).reduce((m, c) => m.set(c.currency, (m.get(c.currency) ?? 0) + Number(c.amount)), new Map<string, number>())))}</dd></div>}
        </dl>
      </Panel>
    </>
  );
}
