import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { FilterSelect } from "@/components/admin/Filters";
import { requirePermission } from "@/lib/admin/guard";
import { first, formatDate } from "@/lib/admin/validation";
import { personName, type Person } from "@/lib/admin/format";

export const metadata = { title: "Affiliates" };
type Row = { id: string; code: string; status: string; commission_rate_bps: number; created_at: string; profiles: Person; affiliate_commissions: { count: number }[] };

export default async function AffiliatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("affiliates");
  if (!ctx) return null;
  const status = first((await searchParams).status);
  let q = ctx.supabase.from("affiliates").select("id, code, status, commission_rate_bps, created_at, profiles:user_id(first_name, last_name, email), affiliate_commissions(count)").order("created_at", { ascending: false });
  if (status && ["pending", "active", "suspended", "rejected"].includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  const rows = (data ?? []) as unknown as Row[];
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Affiliates" subtitle="People apply from their student account (Affiliate). Approve them here; their link starts counting from then. Commissions are calculated by the database when a referred payment is verified." />
      {pending > 0 && !status && <p className="mb-5 rounded-lg border border-violet/40 bg-elevated px-4 py-3 text-body-sm">{pending} application{pending === 1 ? "" : "s"} waiting for review.</p>}
      <div className="mb-5"><FilterSelect param="status" label="Status" options={[{ value: "pending", label: "Pending" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "rejected", label: "Rejected" }]} /></div>
      {error ? <AdminError title="Affiliates need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <DataTable<Row> rows={rows} rowKey={(r) => r.id}
          empty={{ title: status ? "No affiliates with that status" : "No affiliates yet", body: "Share the student Affiliate page with people you'd like to partner with." }}
          columns={[
            { key: "n", header: "Affiliate", primary: true, cell: (r) => <div className="min-w-0"><Link href={`/admin/marketing/affiliates/${r.id}`} className="font-semibold hover:underline">{personName(r.profiles)}</Link><p className="text-caption text-ink-3">ref={r.code}</p></div> },
            { key: "r", header: "Rate", className: "tabular-nums", cell: (r) => `${r.commission_rate_bps / 100}%` },
            { key: "c", header: "Conversions", className: "tabular-nums", cell: (r) => r.affiliate_commissions?.[0]?.count ?? 0 },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "d", header: "Applied", hideOnMobile: true, cell: (r) => formatDate(r.created_at) },
          ]} />
      )}
    </>
  );
}
