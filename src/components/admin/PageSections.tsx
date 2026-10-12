import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { ActionButton } from "./ActionButton";
import { AdminEmpty, AdminError } from "./AdminStates";
import { StatusBadge } from "./StatusBadge";
import { SectionEditor, type SectionRow } from "./SectionEditor";
import { moveSection } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { sectionDef } from "@/lib/admin/sections";
import { formatDate } from "@/lib/admin/validation";

/** Every editable block of one public page, in page order. Each block saves independently. */
export async function PageSections({ page, exclude = [] }: { page: "home" | "about" | "services" | "contact" | "portfolio"; exclude?: string[] }) {
  const ctx = (await getAdminContext())!;
  const [{ data, error }, library, courses] = await Promise.all([
    ctx.supabase.from("page_sections").select("*").eq("page", page).order("display_order").order("created_at"),
    getLibraryImages(ctx),
    ctx.supabase.from("courses").select("slug, title").neq("status", "archived").order("title"),
  ]);
  if (error) {
    console.error("[admin] page_sections:", error.code, error.message);
    return <AdminError title="Unable to load page content" body="Run supabase/migrations/0003_website_cms.sql in the Supabase SQL editor, then refresh." />;
  }
  // interactive_3d was merged into the hero (migration 0004); hide it if 0004 hasn't been run yet.
  const rows = ((data ?? []) as SectionRow[]).filter((r) => !exclude.includes(r.section_key) && !(page === "home" && r.section_key === "interactive_3d"));
  if (!rows.length) return <AdminEmpty title="No sections for this page yet" body="Run migration 0003 to create this page's content blocks." />;
  const reorderable = exclude.length === 0;

  return (
    <ol className="space-y-3">
      {rows.map((s, i) => (
        <li key={s.id}>
          <details className="group rounded-lg border border-line bg-elevated open:border-line-strong">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold">{s.label}</span>
                  <span className="block truncate text-caption text-ink-3">{s.title?.split("\n")[0] ?? "No heading"} · updated {formatDate(s.updated_at)}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={s.status} />
                <ChevronDown aria-hidden className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-line px-5 pb-5 pt-4">
              {reorderable && (
                <div className="mb-4 flex items-center gap-1">
                  <span className="mr-2 text-caption text-ink-3">Position on page</span>
                  <ActionButton action={moveSection} fields={{ sectionId: s.id, dir: "up" }} ariaLabel={`Move ${s.label} up`} disabled={i === 0}><ArrowUp aria-hidden className="h-3.5 w-3.5" />Up</ActionButton>
                  <ActionButton action={moveSection} fields={{ sectionId: s.id, dir: "down" }} ariaLabel={`Move ${s.label} down`} disabled={i === rows.length - 1}><ArrowDown aria-hidden className="h-3.5 w-3.5" />Down</ActionButton>
                </div>
              )}
              <SectionEditor s={s} def={sectionDef(page, s.section_key)} library={library} courses={(courses.data ?? []) as { slug: string; title: string }[]} />
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

export function PreviewLink({ path, label = "Preview" }: { path: string; label?: string }) {
  return (
    <a href={`/api/preview?path=${encodeURIComponent(path)}`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink">{label}</a>
  );
}
