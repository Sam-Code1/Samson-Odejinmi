import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SeoForm, type SeoRow } from "@/components/admin/WebsiteForms";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";

export const metadata = { title: "SEO" };

const ROUTES: { key: string; label: string; path: string }[] = [
  { key: "home", label: "Homepage", path: "/" },
  { key: "about", label: "About", path: "/about" },
  { key: "portfolio", label: "Portfolio", path: "/portfolio" },
  { key: "services", label: "Services", path: "/services" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "academy", label: "Fola Academy", path: "/academy" },
  { key: "academy_courses", label: "Academy courses list", path: "/academy/courses" },
];

export default async function SeoAdmin() {
  const ctx = (await getAdminContext())!;
  const [{ data, error }, library, { data: projects }, { data: courses }] = await Promise.all([
    ctx.supabase.from("seo_metadata").select("*"),
    getLibraryImages(ctx),
    ctx.supabase.from("portfolio_projects").select("id, title, seo_title, seo_description, status").neq("status", "archived").order("display_order"),
    ctx.supabase.from("courses").select("id, title, seo_title, seo_description, status").neq("status", "archived").order("title"),
  ]);
  const byKey = new Map(((data ?? []) as SeoRow[]).map((r) => [r.route_key, r]));
  type Item = { id: string; title: string; seo_title: string | null; seo_description: string | null; status: string };

  return (
    <>
      <PageHeader eyebrow="Website" title="SEO" subtitle={<>Search and social details for each public page. Site-wide defaults are in <Link href="/admin/settings/site" className="underline underline-offset-4">Site settings</Link>. Admin, student, learning and account pages are always hidden from search engines.</>} />
      {error ? <AdminError title="Unable to load SEO settings" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : (
        <div className="space-y-8">
          <ol className="space-y-3">
            {ROUTES.map((r) => {
              const row = byKey.get(r.key);
              if (!row) return null;
              const custom = !!(row.seo_title || row.seo_description);
              return (
                <li key={r.key}>
                  <details className="group rounded-lg border border-line bg-elevated open:border-line-strong">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                      <span><span className="block text-body font-semibold">{r.label}</span><span className="text-caption text-ink-3">{r.path}{row.seo_title ? ` · ${row.seo_title}` : ""}</span></span>
                      <span className="flex items-center gap-2">
                        {row.noindex && <StatusBadge status="noindex" />}
                        <StatusBadge status={custom ? "configured" : "default"} />
                        <ChevronDown aria-hidden className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <div className="border-t border-line px-5 pb-5 pt-4"><SeoForm row={row} library={library} /></div>
                  </details>
                </li>
              );
            })}
          </ol>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Portfolio projects" description="Each project has its own SEO fields on its edit page.">
              <ul className="divide-y divide-line">
                {((projects ?? []) as Item[]).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-body-sm">
                    <Link href={`/admin/website/portfolio/${p.id}`} className="truncate hover:underline">{p.title}</Link>
                    <StatusBadge status={p.seo_title || p.seo_description ? "configured" : "default"} />
                  </li>
                ))}
                {(projects ?? []).length === 0 && <li className="text-body-sm text-ink-3">No projects yet.</li>}
              </ul>
            </Panel>
            <Panel title="Courses" description="Edit on the course's SEO tab.">
              <ul className="divide-y divide-line">
                {((courses ?? []) as Item[]).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-body-sm">
                    <Link href={`/admin/courses/${c.id}?tab=seo`} className="truncate hover:underline">{c.title}</Link>
                    <StatusBadge status={c.seo_title || c.seo_description ? "configured" : "default"} />
                  </li>
                ))}
                {(courses ?? []).length === 0 && <li className="text-body-sm text-ink-3">No courses yet.</li>}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
