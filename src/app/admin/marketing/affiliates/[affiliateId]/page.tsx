import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { AffiliateForm } from "@/components/admin/AffiliateForm";
import { setCommissionStatus } from "@/app/admin/actions/affiliates";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, formatMoneyMinor, isUuid } from "@/lib/admin/validation";
import { personName, type Person } from "@/lib/admin/format";

export const metadata = { title: "Affiliate" };
type Com = { id: string; amount_minor: number; currency: string; rate_bps: number; status: string; created_at: string; status_note: string | null; payments: { reference: string; amount_minor: number; products: { name: string } | null; courses: { title: string } | null } | null };

export default async function AffiliatePage({ params }: { params: Promise<{ affiliateId: string }> }) {
  const { affiliateId } = await params;
  if (!isUuid(affiliateId)) notFound();
  const ctx = await requirePermission("affiliates");
  if (!ctx) return null;
  const [{ data }, { data: coms }, { count: clicks }, { count: clicks30 }] = await Promise.all([
    ctx.supabase.from("affiliates").select("*, profiles:user_id(first_name, last_name, email)").eq("id", affiliateId).maybeSingle(),
    ctx.supabase.from("affiliate_commissions").select("id, amount_minor, currency, rate_bps, status, created_at, status_note, payments(reference, amount_minor, products(name), courses(title))").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliateId),
    ctx.supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliateId).gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);
  if (!data) notFound();
  const a = data as { id: string; code: string; status: string; commission_rate_bps: number; notes: string | null; payout_details: string | null; created_at: string; approved_at: string | null; profiles: Person };
  const rows = (coms ?? []) as unknown as Com[];
  const sum = (st: string) => {
    const m = new Map<string, number>();
    rows.filter((r) => r.status === st).forEach((r) => m.set(r.currency, (m.get(r.currency) ?? 0) + r.amount_minor));
    return m.size ? [...m].map(([c, v]) => formatMoneyMinor(v, c)).join(" · ") : "0";
  };

  return (
    <>
      <PageHeader eyebrow="Affiliate" title={personName(a.profiles)} subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/marketing/affiliates" className="underline underline-offset-4">All affiliates</Link><StatusBadge status={a.status} /><span className="text-caption">ref={a.code}</span></span>} />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clicks (30 days)" value={clicks30 ?? 0} hint={`${clicks ?? 0} all time`} />
        <StatCard label="Conversions" value={rows.filter((r) => r.status !== "cancelled").length} />
        <StatCard label="Pending" value={sum("pending")} />
        <StatCard label="Approved (to pay)" value={sum("approved")} hint={`Paid so far: ${sum("paid")}`} />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="mb-4 text-admin-section">Commissions</h2>
          <DataTable<Com> rows={rows} rowKey={(r) => r.id} empty={{ title: "No commissions yet", body: "One appears when a payment referred by this affiliate is verified." }}
            columns={[
              { key: "p", header: "Sale", primary: true, cell: (r) => <div className="min-w-0"><p>{r.payments?.products?.name ?? r.payments?.courses?.title ?? "Purchase"}</p><p className="break-all text-caption text-ink-3">{r.payments?.reference} · {formatDate(r.created_at)}</p></div> },
              { key: "a", header: "Commission", className: "tabular-nums", cell: (r) => `${formatMoneyMinor(r.amount_minor, r.currency)} (${r.rate_bps / 100}%)` },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "x", header: "", className: "text-right", cell: (r) => (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  {r.status === "pending" && <ActionButton action={setCommissionStatus} fields={{ commissionId: r.id, status: "approved" }} variant="outline">Approve</ActionButton>}
                  {r.status === "approved" && <ActionButton action={setCommissionStatus} fields={{ commissionId: r.id, status: "paid" }} variant="outline" confirm={{ title: "Mark as paid?", body: "Only after you've actually paid the affiliate (e.g. bank transfer).", label: "Mark paid" }}>Mark paid</ActionButton>}
                  {(r.status === "pending" || r.status === "approved") && <ActionButton action={setCommissionStatus} fields={{ commissionId: r.id, status: "cancelled" }} confirm={{ title: "Cancel this commission?", body: "Use for refunds, fraud or self-referrals. It can't be undone.", label: "Cancel commission" }}>Cancel</ActionButton>}
                </span>
              ) },
            ]} />
        </section>
        <div className="space-y-6">
          <AffiliateForm a={a} />
          <Panel title="Payout details" description="Provided by the affiliate. Visible to staff with affiliate access only.">
            <p className="whitespace-pre-wrap break-words text-body-sm">{a.payout_details ?? "Not provided yet."}</p>
          </Panel>
          <Panel title="Account">
            <dl className="space-y-2 text-body-sm">
              <div><dt className="text-caption text-ink-3">Email</dt><dd className="break-all">{a.profiles?.email ?? "–"}</dd></div>
              <div><dt className="text-caption text-ink-3">Applied</dt><dd>{formatDate(a.created_at)}</dd></div>
              {a.approved_at && <div><dt className="text-caption text-ink-3">Approved</dt><dd>{formatDate(a.approved_at)}</dd></div>}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
