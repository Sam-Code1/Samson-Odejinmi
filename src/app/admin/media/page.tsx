import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { CopyButton } from "@/components/admin/CopyButton";
import { MediaDetailsForm } from "@/components/admin/WebsiteForms";
import { deleteMedia } from "@/app/admin/actions/resources";
import { setMediaArchived } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { IMAGE_KINDS } from "@/lib/admin/storage";
import { first, formatBytes, formatDate, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Media" };
const PER = 24;
type Row = {
  id: string; filename: string; public_url: string | null; kind: string; mime_type: string | null; size_bytes: number | null; created_at: string;
  alt_text: string | null; caption: string | null; archived: boolean; created_by: string | null; courses: { title: string } | null; lessons: { title: string } | null;
};
const KINDS: Record<string, string> = { ...IMAGE_KINDS, document: "Document", video_meta: "Video metadata" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const kind = first(sp.kind), page = pageParam(sp.page), q = safeSearch(first(sp.q) ?? ""), show = first(sp.show);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("media_assets").select("id, filename, public_url, kind, mime_type, size_bytes, created_at, alt_text, caption, archived, created_by, courses(title), lessons(title)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PER, page * PER - 1);
  if (kind && KINDS[kind]) query = query.eq("kind", kind);
  if (q) query = query.ilike("filename", `%${q}%`);
  query = query.eq("archived", show === "archived");
  const [{ data, count, error }, { data: courses }, { data: admins }] = await Promise.all([
    query,
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("admin_users").select("user_id, profiles(first_name, last_name, email)"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const who = new Map(((admins ?? []) as unknown as { user_id: string; profiles: { first_name: string; last_name: string; email: string | null } | null }[])
    .map((a) => [a.user_id, a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}`.trim() || a.profiles.email || "Admin" : "Admin"]));

  return (
    <>
      <PageHeader eyebrow="System" title="Media" subtitle="Images for the website, portfolio and courses. Course videos are never stored here: they stay on YouTube. Downloadable course files live in Resources." />
      <Panel title="Upload an image" className="mb-8"><MediaUploadForm courses={(courses ?? []) as { id: string; title: string }[]} /></Panel>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search file names" />
        <FilterSelect param="kind" label="Type" options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="show" label="Show" options={[{ value: "archived", label: "Archived" }]} />
      </div>
      {error ? <AdminError title="Unable to load media" body="Run the latest migration (0003_website_cms.sql), then refresh." /> : rows.length === 0 ? (
        <AdminEmpty title={q || kind || show ? "No media matches" : "No media yet"} body="Images you upload here, or in any editor, appear in this library and can be picked from every image field." />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-lg border border-line bg-elevated">
                <div className="aspect-[4/3] bg-surface">
                  {/* Admin thumbnails: plain img on purpose (any storage URL, no optimisation needed). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.public_url && <img src={m.public_url} alt={m.alt_text ?? m.filename} loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="space-y-2 p-4">
                  <p className="truncate text-body-sm font-medium" title={m.filename}>{m.filename}</p>
                  <p className="text-caption text-ink-3">{KINDS[m.kind] ?? m.kind} · {formatBytes(m.size_bytes)} · {formatDate(m.created_at)}{m.created_by ? ` · ${who.get(m.created_by) ?? "Admin"}` : ""}</p>
                  {(m.courses || m.lessons) && <p className="truncate text-caption text-ink-3">{m.lessons?.title ?? m.courses?.title}</p>}
                  <details className="rounded border border-line">
                    <summary className="cursor-pointer px-3 py-2 text-caption font-semibold text-ink-2">Alt text and caption{m.alt_text ? "" : " (missing alt text)"}</summary>
                    <div className="border-t border-line p-3"><MediaDetailsForm m={m} /></div>
                  </details>
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {m.public_url && <CopyButton value={m.public_url} />}
                    {m.archived
                      ? <ActionButton action={setMediaArchived} fields={{ mediaId: m.id, on: "no" }}><ArchiveRestore aria-hidden className="h-3.5 w-3.5" />Restore</ActionButton>
                      : <ActionButton action={setMediaArchived} fields={{ mediaId: m.id, on: "yes" }}><Archive aria-hidden className="h-3.5 w-3.5" />Archive</ActionButton>}
                    <ActionButton action={deleteMedia} fields={{ mediaId: m.id }} variant="danger" className="ml-auto" ariaLabel={`Delete ${m.filename}`} confirm={{ title: "Delete this image permanently?", body: "Anywhere it's still used will show no image. Archiving is safer.", label: "Delete image" }}><Trash2 aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PER} total={count ?? 0} params={{ kind, q: q || undefined, show }} />
        </>
      )}
    </>
  );
}
