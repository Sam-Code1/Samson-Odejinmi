import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { PreviewLink } from "@/components/admin/PageSections";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { GalleryItemForm, GalleryUploadForm, type GalleryRow } from "@/components/admin/GalleryForms";
import { GALLERY_CATEGORIES } from "@/lib/gallery";
import { getAdminContext } from "@/lib/admin/guard";

export const metadata = { title: "Gallery" };

/** The portfolio gallery behind /work and the homepage: upload pieces, then sort, retitle, feature or hide them. */
export default async function GalleryAdmin() {
  const { supabase } = (await getAdminContext())!;
  const { data, error } = await supabase.from("gallery_items")
    .select("id, title, category, series, description, link_url, kind, src, poster, status, featured, position")
    .order("position").order("created_at");
  const rows = (data ?? []) as GalleryRow[];

  return (
    <>
      <PageHeader eyebrow="Website" title="Gallery" subtitle="Every piece on the Work page and the homepage, by discipline. Upload new work here; it goes live straight away (switch it to Draft to hold it back)."
        actions={<PreviewLink path="/work" />} />
      <Panel title="Add work" className="mb-10"><GalleryUploadForm /></Panel>
      {error ? <AdminError title="Unable to load the gallery" body="Run supabase/migrations/0016_portfolio_gallery.sql, then refresh this page. Until then the site shows the built-in pieces." /> : (
        <div className="space-y-12">
          {GALLERY_CATEGORIES.map((c) => {
            const items = rows.filter((r) => r.category === c.id);
            return (
              <section key={c.id} aria-labelledby={`g-${c.id}`}>
                <h2 id={`g-${c.id}`} className="mb-4 flex items-baseline gap-3 text-admin-section">{c.label}<span className="text-caption font-normal text-ink-3">{items.length} {items.length === 1 ? "piece" : "pieces"}</span></h2>
                {items.length === 0 ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-body-sm text-ink-3">Nothing here yet. It shows as “Adding soon” on the site.</p> : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {items.map((r) => (
                      <li key={r.id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 hover:bg-surface">
                            {r.kind === "video"
                              // eslint-disable-next-line @next/next/no-img-element
                              ? (r.poster ? <img src={r.poster} alt="" className="h-12 w-16 shrink-0 rounded object-cover" /> : <span className="grid h-12 w-16 shrink-0 place-items-center rounded bg-surface text-caption text-ink-3">Video</span>)
                              // eslint-disable-next-line @next/next/no-img-element
                              : <img src={r.src} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{r.title}</span>
                              <span className="text-caption text-ink-3">{[r.series, r.kind === "video" ? "Video" : null, r.featured ? "Featured" : null].filter(Boolean).join(" · ") || " "}</span>
                            </span>
                            <StatusBadge status={r.status === "hidden" ? "archived" : r.status} />
                            <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">›</span>
                          </summary>
                          <div className="border-t border-line px-4 py-5"><GalleryItemForm item={r} /></div>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
