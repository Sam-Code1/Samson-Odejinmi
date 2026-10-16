import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { TRIGGERS, type Trigger } from "@/lib/marketing/steps";

export const metadata = { title: "Automations" };
type Row = { id: string; name: string; trigger_event: Trigger; status: string; steps: unknown[]; automation_runs: { count: number }[] };

export default async function AutomationsPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.from("automations").select("id, name, trigger_event, status, steps, automation_runs(count)").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Automations" subtitle="Simple sequences that start on an event: tag people, wait, check something, send an email. Steps only move forward, so nothing can loop. New automations start as drafts."
        actions={<Link href="/admin/marketing/automations/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New automation</Link>} />
      {error ? <AdminError title="Automations need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
          empty={{ title: "No automations yet", body: "Example: when an ebook is bought → tag ebook-buyer → wait 2 days → send a tips email → wait 3 days → if not enrolled, recommend the course.", action: { href: "/admin/marketing/automations/new", label: "Create an automation" } }}
          columns={[
            { key: "n", header: "Automation", primary: true, cell: (r) => <Link href={`/admin/marketing/automations/${r.id}`} className="font-semibold hover:underline">{r.name}</Link> },
            { key: "t", header: "Starts when", cell: (r) => TRIGGERS[r.trigger_event] ?? r.trigger_event },
            { key: "s", header: "Steps", className: "tabular-nums", cell: (r) => (Array.isArray(r.steps) ? r.steps.length : 0) },
            { key: "r", header: "People started", className: "tabular-nums", cell: (r) => r.automation_runs?.[0]?.count ?? 0 },
            { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          ]} />
      )}
    </>
  );
}
