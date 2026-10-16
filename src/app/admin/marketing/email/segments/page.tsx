import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { SegmentForm } from "@/components/admin/EmailForms";
import { deleteSegment } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin/guard";
import { describeDefinition, type SegmentDefinition } from "@/lib/marketing/segments";

export const metadata = { title: "Audiences" };
type Row = { id: string; name: string; description: string | null; definition: SegmentDefinition; total: number; marketable: number };

export default async function SegmentsPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.from("segments").select("id, name, description, definition").order("name");
  const rows: Row[] = await Promise.all(((data ?? []) as Omit<Row, "total" | "marketable">[]).map(async (s) => {
    const { data: c } = await ctx.supabase.rpc("segment_count", { p_def: s.definition });
    const n = (c as { total: number; marketable: number } | null) ?? { total: 0, marketable: 0 };
    return { ...s, ...n };
  }));
  return (
    <>
      <PageHeader eyebrow="Email" title="Audiences" subtitle={<>Saved, rule-based audiences, counted live. <Link href="/admin/marketing/email" className="underline underline-offset-4">Back to email</Link></>} />
      {error ? <AdminError title="Audiences need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <DataTable<Row> rows={rows} rowKey={(r) => r.id} empty={{ title: "No saved audiences", body: "Presets like “Ebook buyers” or “Never purchased” are always available in the email editor. Save one here to reuse it with tags or a lifecycle." }}
            columns={[
              { key: "n", header: "Audience", primary: true, cell: (r) => <div className="min-w-0"><p className="font-semibold">{r.name}</p><p className="text-caption text-ink-3">{describeDefinition(r.definition)}</p></div> },
              { key: "t", header: "People", className: "tabular-nums", cell: (r) => r.total },
              { key: "m", header: "Can be emailed", className: "tabular-nums", cell: (r) => r.marketable },
              { key: "a", header: "", className: "text-right", cell: (r) => <ActionButton action={deleteSegment} fields={{ segmentId: r.id }} confirm={{ title: `Delete “${r.name}”?`, body: "Emails already sent aren't affected.", label: "Delete" }}>Delete</ActionButton> },
            ]} />
          <SegmentForm />
        </div>
      )}
    </>
  );
}
