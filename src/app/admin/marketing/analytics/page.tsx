import Link from "next/link";
import { MousePointerClick, Receipt, ShoppingCart, Users, Wallet } from "lucide-react";
import { PageHeader, Panel, SectionTitle } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { AdminError } from "@/components/admin/AdminStates";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { TrendChart } from "@/components/admin/charts/TrendChart";
import { BarList } from "@/components/admin/charts/BarList";
import { Funnel } from "@/components/admin/charts/Funnel";
import { fmt } from "@/components/admin/charts/format";
import { requirePermission } from "@/lib/admin/guard";
import { PERIODS, getMarketingStats, moneyMap, pct, periodDays, type MarketingStats } from "@/lib/admin/marketing-stats";
import { getDashboardSeries } from "@/lib/admin/timeseries";
import { first } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

export const metadata = { title: "Marketing analytics" };
const moneyShort = (m: Record<string, number> | null | undefined) => (m && Object.keys(m).length ? Object.entries(m).map(([c, v]) => fmt(Number(v), `money:${c}`, true)).join(" · ") : "0");
type Camp = MarketingStats["campaigns"][number];

/** Every figure from stored records only. Each period is compared with the period of the same length before it. */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const sp = await searchParams;
  const days = periodDays(first(sp.days));
  const period = PERIODS[String(days) as keyof typeof PERIODS].toLowerCase();
  const [{ stats: s, error }, { stats: before }, series] = await Promise.all([getMarketingStats(ctx, days), getMarketingStats(ctx, days, days), getDashboardSeries(ctx, days)]);
  if (error || !s) return <><PageHeader eyebrow="Sales & marketing" title="Analytics" /><AdminError title="Analytics need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /></>;
  const p = before;
  const e = s.email;
  const curs = Object.keys(s.revenue ?? {}).sort((a, b) => (s.revenue![b] ?? 0) - (s.revenue![a] ?? 0));
  const cur = typeof sp.cur === "string" && series.currencies.includes(sp.cur) ? sp.cur : series.currencies[0];
  const rev = series.revenue[cur];
  const main = curs[0] ?? cur;
  const conv = (x: MarketingStats | null) => (x && x.checkouts_started ? (x.checkouts_completed / x.checkouts_started) * 100 : 0);

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Analytics" subtitle={`Sales, conversion, email and campaigns over the ${period}, compared with the period before. Opens and clicks appear only when the email provider reports them.`}
        actions={<PeriodFilter current={days} basePath="/admin/marketing/analytics" />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s.can_see_revenue && <StatCard label={`Revenue · ${main}`} value={fmt(s.revenue?.[main] ?? 0, `money:${main}`)} icon={Wallet} delta={{ cur: s.revenue?.[main] ?? 0, prev: p?.revenue?.[main] ?? 0 }} spark={series.revenue[main]?.spark} hint={curs.length > 1 ? `+ ${curs.slice(1).map((c) => fmt(s.revenue![c], `money:${c}`, true)).join(" · ")}` : undefined} />}
        <StatCard label="Orders" value={s.orders} icon={Receipt} delta={{ cur: s.orders, prev: p?.orders ?? 0 }} spark={series.orders.spark} slot={3} hint={`${s.paid_orders} paid`} />
        <StatCard label="Checkout conversion" value={pct(s.checkouts_completed, s.checkouts_started)} icon={ShoppingCart} delta={{ cur: conv(s), prev: conv(p) }} slot={4} hint={`${s.checkouts_completed} of ${s.checkouts_started} checkouts`} />
        <StatCard label="New contacts" value={s.new_contacts} icon={Users} delta={{ cur: s.new_contacts, prev: p?.new_contacts ?? 0 }} slot={2} hint={`${s.subscribers.toLocaleString("en")} subscribers now`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        {s.can_see_revenue && rev && (
          <Panel className="xl:col-span-8" title="Revenue over time" description={`Paid orders in ${cur}. The grey line is the period before.`}
            actions={series.currencies.length > 1 ? (
              <nav aria-label="Currency" className="inline-flex rounded-lg border border-line bg-surface/60 p-0.5">
                {series.currencies.map((c) => <Link key={c} href={`/admin/marketing/analytics?days=${days}&cur=${c}`} aria-current={c === cur ? "true" : undefined} className={cn("rounded-md px-2.5 py-1 text-[0.78rem] font-semibold", c === cur ? "bg-elevated text-ink shadow-[var(--ad-shadow)]" : "text-ink-3 hover:text-ink")}>{c}</Link>)}
              </nav>
            ) : undefined}>
            <TrendChart points={rev.points} format={`money:${cur}`} label={`Revenue (${cur})`} height={260} />
          </Panel>
        )}
        <Panel className={s.can_see_revenue && rev ? "xl:col-span-4" : "xl:col-span-12"} title="Checkout funnel" description="From starting checkout to paying.">
          <Funnel stages={[{ label: "Checkouts started", value: s.checkouts_started }, { label: "Completed", value: s.checkouts_completed }, { label: "Paid orders", value: s.paid_orders }]} />
          <p className="mt-5 text-caption text-ink-3">Abandoned checkouts: <span className="ad-num font-semibold text-ink-2">{Math.max(0, s.checkouts_started - s.checkouts_completed).toLocaleString("en")}</span>. Automations can follow up on these.</p>
        </Panel>

        <Panel className="xl:col-span-7" title="Best-selling products" description="By orders this period.">
          <BarList rows={s.product_sales.map((r) => ({ key: `${r.name}-${r.currency}`, label: r.name, value: r.orders, display: `${r.orders} order${r.orders === 1 ? "" : "s"}`, hint: s.can_see_revenue && r.revenue != null ? fmt(r.revenue, `money:${r.currency}`, true) : (r.type ?? undefined) }))} empty="No sales in this period." />
        </Panel>
        <Panel className="xl:col-span-5" title="Where buyers came from" description="Orders by traffic source (last touch).">
          <BarList slot={3} rows={Object.values(s.sources.reduce<Record<string, { source: string; orders: number }>>((m, r) => { (m[r.source] ??= { source: r.source, orders: 0 }).orders += r.orders; return m; }, {}))
            .map((r) => ({ key: r.source, label: r.source === "direct" ? "Direct / unknown" : r.source, value: r.orders, display: `${r.orders}`, hint: pct(r.orders, s.orders) }))} empty="No attributed orders yet." />
          <Link href="/admin/marketing/attribution" className="mt-5 inline-block text-caption font-semibold text-ink-2 hover:text-ink">Full attribution report</Link>
        </Panel>
      </div>

      <SectionTitle className="mt-12">Email</SectionTitle>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-7" title="Email funnel" description="Of the emails sent this period.">
          <Funnel slot={3} stages={[{ label: "Sent", value: e.sent }, { label: "Delivered", value: e.delivered }, { label: "Opened", value: e.opened }, { label: "Clicked", value: e.clicked }]} />
        </Panel>
        <div className="grid grid-cols-2 gap-4 xl:col-span-5">
          <StatCard label="Open rate" value={pct(e.opened, e.sent)} icon={MousePointerClick} delta={{ cur: e.sent ? e.opened / e.sent : 0, prev: p?.email.sent ? p.email.opened / p.email.sent : 0 }} />
          <StatCard label="Click rate" value={pct(e.clicked, e.sent)} delta={{ cur: e.sent ? e.clicked / e.sent : 0, prev: p?.email.sent ? p.email.clicked / p.email.sent : 0 }} />
          <StatCard label="Bounced" value={e.bounced} delta={{ cur: e.bounced, prev: p?.email.bounced ?? 0, goodWhenDown: true }} hint={e.failed ? `${e.failed} failed to send` : undefined} />
          <StatCard label="Unsubscribed" value={s.unsubscribes} delta={{ cur: s.unsubscribes, prev: p?.unsubscribes ?? 0, goodWhenDown: true }} hint={`${e.unsubscribed} via email link`} />
        </div>
      </div>

      <SectionTitle className="mt-12">Coupons, campaigns and affiliates</SectionTitle>
      <div className="grid gap-6 xl:grid-cols-12">
        <Panel className="xl:col-span-5" title="Coupons used">
          <BarList slot={2} rows={s.coupons.map((r) => ({ key: `${r.code}-${r.currency}`, label: r.code, value: r.uses, display: `${r.uses} use${r.uses === 1 ? "" : "s"}`, hint: `${fmt(r.discount, `money:${r.currency}`, true)} off` }))} empty="No coupons used in this period." />
        </Panel>
        <Panel className="xl:col-span-7" title="Affiliates">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Referral clicks", s.affiliates.clicks.toLocaleString("en")],
              ["Referred orders", s.affiliates.orders.toLocaleString("en")],
              ...(s.can_see_revenue ? [["Referred revenue", moneyShort(s.affiliates.revenue)], ["Commission", moneyShort(Object.fromEntries((s.affiliates.commission ?? []).reduce((m, c) => m.set(c.currency, (m.get(c.currency) ?? 0) + Number(c.amount)), new Map<string, number>())))]] : []),
            ].map(([k, v]) => <div key={k} className="min-w-0 rounded-xl bg-surface/60 p-3.5"><dt className="text-caption text-ink-3">{k}</dt><dd className="ad-num mt-1.5 break-words text-[1.125rem] font-semibold leading-tight">{v}</dd></div>)}
          </dl>
          <p className="mt-4 text-caption text-ink-3">Conversion from clicks: {pct(s.affiliates.orders, s.affiliates.clicks)}.</p>
        </Panel>
      </div>
      <div className="mt-6">
        <DataTable<Camp> rows={s.campaigns} rowKey={(r) => r.slug} empty={{ title: "No campaigns yet", body: "Create one under Campaigns. Orders count when the buyer arrived with its utm_campaign, or used one of its coupons.", action: { href: "/admin/marketing/campaigns", label: "Campaigns" } }}
          columns={[
            { key: "n", header: "Campaign", primary: true, cell: (r) => <div className="min-w-0"><p className="font-medium">{r.name}</p><p className="text-caption text-ink-3">utm_campaign={r.slug}</p></div> },
            { key: "o", header: "Orders", className: "ad-num", cell: (r) => r.orders },
            ...(s.can_see_revenue ? [{ key: "r", header: "Revenue", className: "ad-num", cell: (r: Camp) => moneyMap(r.revenue) }] : []),
            { key: "e", header: "Emails sent", className: "ad-num", cell: (r) => r.emails_sent.toLocaleString("en") },
          ]} />
      </div>
    </>
  );
}
