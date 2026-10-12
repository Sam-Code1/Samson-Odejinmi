import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect } from "@/components/admin/Filters";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam } from "@/lib/admin/validation";

export const metadata = { title: "Activity" };
type Row = { id: string; actor_email: string | null; action: string; resource_type: string; resource_label: string | null; created_at: string };

const TYPES = ["page_section", "portfolio_project", "service", "social_link", "seo", "site_settings", "course", "lesson", "quiz", "question", "ai_generation", "contact_message"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const type = first(sp.type), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let q = supabase.from("activity_logs").select("id, actor_email, action, resource_type, resource_label, created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (type && TYPES.includes(type)) q = q.eq("resource_type", type);
  const { data, count, error } = await q;

  return (
    <>
      <PageHeader eyebrow="System" title="Activity" subtitle="A record of important admin changes: who did what, to which item, and when. Content and secrets are never logged." />
      <div className="mb-5"><FilterSelect param="type" label="Type" options={TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} /></div>
      {error ? <AdminError title="Unable to load activity" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as Row[]} rowKey={(r) => r.id} empty={{ title: "No activity yet", body: "Changes you make in Admin are recorded here." }}
            columns={[
              { key: "a", header: "Action", primary: true, cell: (r) => <span className="font-medium first-letter:uppercase">{r.action}</span> },
              { key: "r", header: "Item", cell: (r) => r.resource_label ?? r.resource_type.replace(/_/g, " ") },
              { key: "u", header: "By", cell: (r) => r.actor_email ?? "–" },
              { key: "t", header: "When", cell: (r) => formatDate(r.created_at, true) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ type }} />
        </>
      )}
    </>
  );
}
