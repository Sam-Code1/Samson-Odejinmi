import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { AdminError } from "@/components/admin/AdminStates";
import { ActionButton } from "@/components/admin/ActionButton";
import { PeriodFilter, ShareBar } from "@/components/admin/PeriodFilter";
import { runMarketingNow } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin/guard";
import { getMarketingStats, moneyMap, pct, periodDays } from "@/lib/admin/marketing-stats";
import { first } from "@/lib/admin/validation";
import { emailConfigured } from "@/lib/email";
import { getWhatsAppProvider } from "@/lib/whatsapp";

export const metadata = { title: "Marketing" };

function Setup({ ok, label, fix }: { ok: boolean; label: string; fix: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-2.5 text-body-sm">
      <span className="min-w-0"><span className="block">{label}</span>{!ok && <span className="block text-caption text-ink-3">{fix}</span>}</span>
      <span className={ok ? "shrink-0 text-blue" : "shrink-0 text-warm"}>{ok ? "Ready" : "Not set"}</span>
    </li>
  );
}

export default async function MarketingOverview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const days = periodDays(first((await searchParams).days));
  const { stats: s, error } = await getMarketingStats(ctx, days);

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Overview" subtitle="Real numbers from payments, contacts, coupons, affiliates and email. Nothing here is estimated."
        actions={<ActionButton action={runMarketingNow} fields={{}} variant="outline" className="h-10 px-4 text-label">Run marketing queue now</ActionButton>} />
      <div className="mb-6"><PeriodFilter current={days} basePath="/admin/marketing" /></div>
      {error || !s ? <AdminError title="Marketing needs the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {s.can_see_revenue && <StatCard label="Revenue" value={moneyMap(s.revenue)} href="/admin/payments" />}
            <StatCard label="Orders" value={s.orders} hint={`${s.paid_orders} paid · ${s.orders - s.paid_orders} free`} />
            <StatCard label="Customers" value={s.customers} hint="People with an order in this period" />
            <StatCard label="Checkout conversion" value={pct(s.checkouts_completed, s.checkouts_started)} hint={`${s.checkouts_completed} of ${s.checkouts_started} checkouts completed`} />
            <StatCard label="Subscribers" value={s.subscribers} hint="Opted in, reachable now" href="/admin/marketing/email" />
            <StatCard label="New contacts" value={s.new_contacts} />
            <StatCard label="Emails sent" value={s.email.sent} hint={s.email.sent ? `${pct(s.email.opened, s.email.sent)} opened · ${pct(s.email.clicked, s.email.sent)} clicked` : "Open/click rates appear once the email webhook is connected"} />
            <StatCard label="Affiliate orders" value={s.affiliates.orders} hint={s.can_see_revenue ? moneyMap(s.affiliates.revenue) : `${s.affiliates.clicks} referral clicks`} />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <Panel title="Top products" description="By orders in this period.">
              {s.product_sales.length === 0 ? <p className="text-body-sm text-ink-3">No sales in this period.</p> : (
                <ul className="space-y-4">
                  {s.product_sales.slice(0, 6).map((p) => (
                    <li key={`${p.name}-${p.currency}`}>
                      <p className="mb-1.5 flex justify-between gap-3 text-body-sm"><span className="min-w-0 truncate">{p.name}</span>{p.revenue != null && <span className="shrink-0 tabular-nums text-ink-3">{moneyMap({ [p.currency]: p.revenue })}</span>}</p>
                      <ShareBar value={p.orders} max={s.product_sales[0].orders} label={`${p.orders} order${p.orders === 1 ? "" : "s"}`} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Where buyers came from" description="Last touch before purchase (UTM source, affiliate or direct).">
              {s.sources.length === 0 ? <p className="text-body-sm text-ink-3">No orders in this period.</p> : (
                <ul className="space-y-4">
                  {s.sources.slice(0, 6).map((r) => (
                    <li key={`${r.source}-${r.currency}`}>
                      <p className="mb-1.5 text-body-sm capitalize">{r.source}</p>
                      <ShareBar value={r.orders} max={s.sources[0].orders} label={`${r.orders} order${r.orders === 1 ? "" : "s"}`} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-5 text-caption"><Link href={`/admin/marketing/attribution?days=${days}`} className="underline underline-offset-4">Full attribution</Link></p>
            </Panel>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Panel title="Coupons used" description="Redemptions in this period.">
              {s.coupons.length === 0 ? <p className="text-body-sm text-ink-3">No coupons used.</p> : (
                <ul className="divide-y divide-line">{s.coupons.slice(0, 6).map((c) => (
                  <li key={`${c.code}-${c.currency}`} className="flex justify-between gap-3 py-2.5 text-body-sm"><span className="font-semibold tracking-wide">{c.code}</span><span className="tabular-nums text-ink-2">{c.uses} use{c.uses === 1 ? "" : "s"} · {moneyMap({ [c.currency]: c.discount })} off</span></li>
                ))}</ul>
              )}
            </Panel>
            <Panel title="Setup" description="What the marketing system can do right now.">
              <ul className="divide-y divide-line">
                <Setup ok={emailConfigured()} label="Email provider" fix="Set RESEND_API_KEY (and EMAIL_FROM)." />
                <Setup ok={Boolean(process.env.RESEND_WEBHOOK_SECRET)} label="Delivery / open / click tracking" fix="Add the Resend webhook and RESEND_WEBHOOK_SECRET." />
                <Setup ok={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} label="Sending queue + automations" fix="Set SUPABASE_SERVICE_ROLE_KEY." />
                <Setup ok={Boolean(process.env.CRON_SECRET)} label="Scheduled runs (cron)" fix="Set CRON_SECRET; Vercel Cron calls /api/cron/marketing (see vercel.json)." />
                <Setup ok={getWhatsAppProvider() !== null} label="WhatsApp" fix="Optional. See WhatsApp in this menu." />
              </ul>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
