import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Email" };
type Row = { id: string; name: string; subject: string; status: string; recipients_count: number; scheduled_at: string | null; sent_at: string | null; updated_at: string };

export default async function EmailPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data, error }, { data: subs }, { count: segCount }] = await Promise.all([
    ctx.supabase.from("email_campaigns").select("id, name, subject, status, recipients_count, scheduled_at, sent_at, updated_at").order("updated_at", { ascending: false }).limit(100),
    ctx.supabase.rpc("segment_count", { p_def: { preset: "all_subscribers" } }),
    ctx.supabase.from("segments").select("id", { count: "exact", head: true }),
  ]);
  const s = (subs as { total: number; marketable: number } | null) ?? null;

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Email" subtitle="Campaign emails go only to people who opted in. Every email has a one-click unsubscribe. Open and click numbers come from the email provider; nothing is estimated."
        actions={<Link href="/admin/marketing/email/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New email</Link>} />
      {!emailConfigured() && <p className="mb-6 rounded-lg border border-warm/40 bg-elevated px-4 py-3 text-body-sm text-ink-2">Email isn&apos;t configured (RESEND_API_KEY), so nothing can be sent yet. You can still write drafts.</p>}
      {error ? <AdminError title="Email needs the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Can receive marketing" value={s?.marketable ?? 0} hint="Opted in, not unsubscribed or bouncing" />
            <StatCard label="Saved audiences" value={segCount ?? 0} href="/admin/marketing/email/segments" />
          </div>
          <DataTable<Row> rows={(data ?? []) as Row[]} rowKey={(r) => r.id}
            empty={{ title: "No emails yet", body: "Write a campaign, send yourself a test, then send or schedule it.", action: { href: "/admin/marketing/email/new", label: "Write an email" } }}
            columns={[
              { key: "n", header: "Email", primary: true, cell: (r) => <div className="min-w-0"><Link href={`/admin/marketing/email/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><p className="truncate text-caption text-ink-3">{r.subject}</p></div> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "r", header: "Recipients", className: "tabular-nums", cell: (r) => (r.status === "draft" ? "–" : r.recipients_count) },
              { key: "d", header: "When", cell: (r) => (r.sent_at ? `Sent ${formatDate(r.sent_at, true)}` : r.scheduled_at && r.status === "scheduled" ? `For ${formatDate(r.scheduled_at, true)}` : formatDate(r.updated_at)) },
            ]} />
        </>
      )}
    </>
  );
}
