import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { PageSections, PreviewLink } from "@/components/admin/PageSections";
import { moveService, setServiceStatus } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";

export const metadata = { title: "Services" };
type Row = { id: string; name: string; slug: string; status: string; short_description: string | null; updated_at: string };

export default async function ServicesAdmin() {
  const { supabase } = (await getAdminContext())!;
  const { data, error } = await supabase.from("services").select("id, name, slug, status, short_description, updated_at").order("display_order").order("created_at");
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Website" title="Services" subtitle="What you offer, in the order it appears on the Services page. Only list services you actually provide."
        actions={<><PreviewLink path="/services" /><Link href="/admin/website/services/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New service</Link></>} />
      {error ? <AdminError title="Unable to load services" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : (
        <DataTable<Row> rows={rows} rowKey={(r) => r.id}
          empty={{ title: "No services yet", body: "Add the kinds of work you take on.", action: { href: "/admin/website/services/new", label: "Create your first service" } }}
          columns={[
            { key: "order", header: "Order", hideOnMobile: true, cell: (r) => (
              <div className="flex gap-0.5">
                <ActionButton action={moveService} fields={{ serviceId: r.id, dir: "up" }} ariaLabel={`Move ${r.name} up`} disabled={rows[0]?.id === r.id}><ArrowUp aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                <ActionButton action={moveService} fields={{ serviceId: r.id, dir: "down" }} ariaLabel={`Move ${r.name} down`} disabled={rows[rows.length - 1]?.id === r.id}><ArrowDown aria-hidden className="h-3.5 w-3.5" /></ActionButton>
              </div>
            ) },
            { key: "name", header: "Service", primary: true, cell: (r) => <div className="min-w-0"><Link href={`/admin/website/services/${r.id}`} className="font-medium hover:underline">{r.name}</Link>{r.short_description && <p className="line-clamp-1 text-caption text-ink-3">{r.short_description}</p>}</div> },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "upd", header: "Updated", hideOnMobile: true, cell: (r) => formatDate(r.updated_at) },
            { key: "act", header: "", className: "text-right", cell: (r) => r.status === "published"
              ? <ActionButton action={setServiceStatus} fields={{ serviceId: r.id, to: "draft" }}>Unpublish</ActionButton>
              : r.status === "archived" ? <ActionButton action={setServiceStatus} fields={{ serviceId: r.id, to: "draft" }}>Restore</ActionButton>
              : <ActionButton action={setServiceStatus} fields={{ serviceId: r.id, to: "published" }} variant="outline">Publish</ActionButton> },
          ]} />
      )}
      <section className="mt-12">
        <h2 className="mb-1 text-admin-section">Services page text and process</h2>
        <p className="mb-4 text-body-sm text-ink-3">The process steps are shared with the homepage.</p>
        <PageSections page="services" />
      </section>
    </>
  );
}
