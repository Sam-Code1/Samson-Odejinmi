import Link from "next/link";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { FilterSelect } from "@/components/admin/Filters";
import { PageSections, PreviewLink } from "@/components/admin/PageSections";
import { Panel } from "@/components/admin/PageHeader";
import { NewWebsiteProjectForm } from "@/components/admin/WebsiteImportForms";
import { moveProject, setProjectStatus, toggleProjectFeatured } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { first, formatDate } from "@/lib/admin/validation";

export const metadata = { title: "Projects" };
// Creating a project from a website link captures it (~40 seconds).
export const maxDuration = 60;
type Row = { id: string; title: string; slug: string; category: string | null; status: string; featured: boolean; is_placeholder: boolean; project_status: string; cover_image_url: string | null; updated_at: string };

export default async function PortfolioAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const { supabase } = (await getAdminContext())!;
  let q = supabase.from("portfolio_projects").select("id, title, slug, category, status, featured, is_placeholder, project_status, cover_image_url, updated_at").order("display_order").order("created_at");
  if (status && ["draft", "published", "archived"].includes(status)) q = q.eq("status", status);
  else q = q.neq("status", "archived");
  const { data, error } = await q;
  const rows = (data ?? []) as Row[];
  const placeholders = rows.filter((r) => r.is_placeholder && r.status === "published").length;

  return (
    <>
      <PageHeader eyebrow="Website" title="Projects" subtitle="Case studies: create, edit, order and publish. Click a project's title to edit its page. The order here is the order on the site; “Homepage” controls Selected work."
        actions={<><PreviewLink path="/portfolio" /><Link href="/admin/website/portfolio/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New project</Link></>} />
      {placeholders > 0 && (
        <p className="mb-5 rounded-lg border border-violet/40 bg-elevated px-4 py-3 text-body-sm text-ink-2">
          {placeholders} published {placeholders === 1 ? "entry is a placeholder" : "entries are placeholders"}, clearly labelled on the site. Replace {placeholders === 1 ? "it" : "them"} with real work, or archive {placeholders === 1 ? "it" : "them"}.
        </p>
      )}
      <Panel title="Add a website you built" description="Paste the link. The project fills itself in with the site's name, description, a cover, a scrolling full-page capture, a phone view and section screenshots, as a draft for you to review." className="mb-8">
        <div className="max-w-2xl"><NewWebsiteProjectForm /></div>
      </Panel>
      <div className="mb-5"><FilterSelect param="status" label="Status" options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} /></div>
      {error ? <AdminError title="Unable to load portfolio projects" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : (
        <DataTable<Row> rows={rows} rowKey={(r) => r.id}
          empty={{ title: status ? "No projects with that status" : "No portfolio projects yet", body: "Add real work: personal studies, concepts and experiments are welcome, labelled honestly.", action: { href: "/admin/website/portfolio/new", label: "Create your first project" } }}
          columns={[
            { key: "order", header: "Order", hideOnMobile: true, cell: (r) => (
              <div className="flex gap-0.5">
                <ActionButton action={moveProject} fields={{ projectId: r.id, dir: "up" }} ariaLabel={`Move ${r.title} up`} disabled={rows[0]?.id === r.id || !!status}><ArrowUp aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                <ActionButton action={moveProject} fields={{ projectId: r.id, dir: "down" }} ariaLabel={`Move ${r.title} down`} disabled={rows[rows.length - 1]?.id === r.id || !!status}><ArrowDown aria-hidden className="h-3.5 w-3.5" /></ActionButton>
              </div>
            ) },
            { key: "title", header: "Project", primary: true, cell: (r) => (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.cover_image_url ? <img src={r.cover_image_url} alt="" className="h-10 w-14 shrink-0 rounded object-cover" /> : <span className="h-10 w-14 shrink-0 rounded bg-surface" aria-hidden />}
                <div className="min-w-0"><Link href={`/admin/website/portfolio/${r.id}`} className="block truncate font-medium hover:underline">{r.title}</Link><span className="text-caption text-ink-3">/{r.slug}</span></div>
              </div>
            ) },
            { key: "cat", header: "Category", cell: (r) => r.category ?? "–" },
            { key: "label", header: "Label", cell: (r) => r.is_placeholder ? <StatusBadge status="placeholder" /> : r.project_status },
            { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "home", header: "Homepage", cell: (r) => <ActionButton action={toggleProjectFeatured} fields={{ projectId: r.id, on: r.featured ? "no" : "yes" }} variant={r.featured ? "outline" : "ghost"}>{r.featured ? "Shown" : "Show"}</ActionButton> },
            { key: "upd", header: "Updated", hideOnMobile: true, cell: (r) => formatDate(r.updated_at) },
            { key: "act", header: "", className: "text-right", cell: (r) => r.status === "published"
              ? <ActionButton action={setProjectStatus} fields={{ projectId: r.id, to: "draft" }}>Unpublish</ActionButton>
              : r.status === "archived" ? <ActionButton action={setProjectStatus} fields={{ projectId: r.id, to: "draft" }}>Restore</ActionButton>
              : <ActionButton action={setProjectStatus} fields={{ projectId: r.id, to: "published" }} variant="outline" confirm={{ title: `Publish “${r.title}”?`, body: "It becomes visible on the public portfolio.", label: "Publish" }}>Publish</ActionButton> },
          ]} />
      )}
      <section className="mt-12">
        <h2 className="mb-3 text-admin-section">Portfolio page introduction</h2>
        <PageSections page="portfolio" />
      </section>
    </>
  );
}
