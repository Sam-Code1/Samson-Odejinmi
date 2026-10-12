import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { PreviewLink } from "@/components/admin/PageSections";
import { GalleryAddForm, GalleryItemForm, ProjectForm, type ProjectRow } from "@/components/admin/WebsiteForms";
import { deleteGalleryImage, deleteProject, moveGalleryImage, setProjectStatus } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Edit project" };
type Media = { id: string; url: string; alt: string; caption: string | null };

export default async function EditProject({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!isUuid(projectId)) notFound();
  const ctx = (await getAdminContext())!;
  const [{ data }, { data: media }, library, { data: cats }] = await Promise.all([
    ctx.supabase.from("portfolio_projects").select("*").eq("id", projectId).maybeSingle(),
    ctx.supabase.from("portfolio_media").select("id, url, alt, caption").eq("project_id", projectId).order("display_order").order("created_at"),
    getLibraryImages(ctx),
    ctx.supabase.from("portfolio_projects").select("categories"),
  ]);
  if (!data) notFound();
  const p = data as ProjectRow;
  const gallery = (media ?? []) as Media[];
  const categories = [...new Set(((cats ?? []) as { categories: string[] }[]).flatMap((c) => c.categories ?? []))];

  return (
    <>
      <PageHeader eyebrow="Portfolio" title={p.title} subtitle={<Link href="/admin/website/portfolio" className="underline underline-offset-4">All projects</Link>}
        actions={<><StatusBadge status={p.status} /><PreviewLink path={`/portfolio/${p.slug}`} /></>} />
      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <ProjectForm p={p} library={library} categorySuggestions={categories} />
        <div className="space-y-6">
          <Panel title={`Gallery (${gallery.length})`} description="Images shown below the case study, in this order.">
            {gallery.length === 0 ? <p className="text-body-sm text-ink-3">No gallery images yet.</p> : (
              <ul className="space-y-4">
                {gallery.map((g, i) => (
                  <li key={g.id} className="rounded border border-line p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.alt} className="aspect-[4/3] w-full rounded object-cover" />
                    <div className="mt-3"><GalleryItemForm item={g} /></div>
                    <div className="mt-2 flex items-center gap-1">
                      <ActionButton action={moveGalleryImage} fields={{ mediaId: g.id, projectId, dir: "up" }} ariaLabel="Move image up" disabled={i === 0}><ArrowUp aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton action={moveGalleryImage} fields={{ mediaId: g.id, projectId, dir: "down" }} ariaLabel="Move image down" disabled={i === gallery.length - 1}><ArrowDown aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton action={deleteGalleryImage} fields={{ mediaId: g.id }} variant="danger" ariaLabel="Remove from gallery" className="ml-auto" confirm={{ title: "Remove this image from the gallery?", body: "The file stays in the media library.", label: "Remove" }}><Trash2 aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-line pt-5"><GalleryAddForm projectId={projectId} library={library} /></div>
          </Panel>

          <Panel title="Status">
            <div className="flex flex-wrap gap-2">
              {p.status !== "archived"
                ? <ActionButton action={setProjectStatus} fields={{ projectId, to: "archived" }} variant="outline" confirm={{ title: "Archive this project?", body: "It disappears from the site but stays here, so you can restore it later.", label: "Archive" }}>Archive</ActionButton>
                : <ActionButton action={setProjectStatus} fields={{ projectId, to: "draft" }} variant="outline">Restore as draft</ActionButton>}
            </div>
          </Panel>

          <Panel title="Danger zone">
            <ActionButton action={deleteProject} fields={{ projectId }} variant="danger" className="h-9 px-3" confirm={{ title: `Delete “${p.title}”?`, body: "The project and its gallery list are deleted permanently. Consider archiving instead.", label: "Delete project" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete project</ActionButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
