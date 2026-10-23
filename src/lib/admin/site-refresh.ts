import type { AdminContext } from "./guard";
import { captureSite, normaliseSiteUrl, type Capture, type SitePreview } from "./site-capture";

/**
 * Keeps a website project in step with the live site. Used by the "Refresh screenshots" button and by the daily
 * scheduled job (/api/cron/site-previews). When the site has visibly changed, the HD screenshots are replaced: the
 * previous files are removed from storage, the gallery shots it added are swapped (never duplicated) and the cover
 * follows unless you chose your own. When nothing changed, nothing is uploaded; only the "checked" time moves.
 */
export type ProjectSiteRow = {
  id: string; slug: string; title: string; short_description: string | null; cover_image_url: string | null;
  tools: string[] | null; discipline: string | null; site_preview: SitePreview | null; project_url: string | null; live_preview?: boolean | null;
};
export const PROJECT_SITE_COLS = "id, slug, title, short_description, cover_image_url, tools, discipline, site_preview, project_url, live_preview";

export type RefreshResult =
  | { ok: true; changed: boolean; embeddable: boolean; shots: number; title: string }
  | { ok: false; error: string };

const BUCKET = "academy-media";
const MARK = `/storage/v1/object/public/${BUCKET}/`;
const storagePath = (src: string | undefined | null) => {
  const i = src ? src.indexOf(MARK) : -1;
  const p = i >= 0 ? decodeURIComponent(src!.slice(i + MARK.length)) : null;
  return p && p.startsWith("portfolio/") ? p : null; // only files our captures created
};

export const captureTitle = (c: Capture) => (c.preview.title ?? c.preview.domain).split(/\s[|–—·-]\s/)[0].trim().slice(0, 140) || c.preview.domain;

/** Add a capture's section and phone screenshots to the end of the project's gallery. */
export async function addGalleryShots(ctx: AdminContext, projectId: string, c: Capture) {
  const { data: last } = await ctx.supabase.from("portfolio_media").select("display_order").eq("project_id", projectId).order("display_order", { ascending: false }).limit(1);
  let order = Number(last?.[0]?.display_order ?? 0);
  const t = captureTitle(c);
  const rows = [
    ...c.sections.map((s, i) => ({ url: s.src, alt: `${t}: section ${i + 2}`, caption: null })),
    ...(c.preview.mobile ? [{ url: c.preview.mobile.src, alt: `${t} on a phone`, caption: "On a phone" }] : []),
  ].map((r) => ({ ...r, project_id: projectId, display_order: (order += 10) }));
  if (rows.length) await ctx.supabase.from("portfolio_media").insert(rows);
}

/** Remove a previous capture's files (storage, media library, and the gallery rows it added). */
async function removeCapture(ctx: AdminContext, projectId: string, old: SitePreview, keep: Set<string>) {
  let gallery = old.gallery;
  if (!gallery) {
    // Captured before the list was recorded: this project's capture shots by file name (…-section-N.webp / …-mobile.webp).
    const { data } = await ctx.supabase.from("portfolio_media").select("url").eq("project_id", projectId)
      .or("url.like.%/portfolio/%-section-_.webp,url.like.%/portfolio/%-mobile.webp");
    gallery = ((data ?? []) as { url: string }[]).map((r) => r.url);
  }
  const srcs = [old.hero?.src, old.tall?.src, old.mobile?.src, ...gallery].filter((s): s is string => !!s && !keep.has(s));
  if (!srcs.length) return;
  if (gallery.length) await ctx.supabase.from("portfolio_media").delete().eq("project_id", projectId).in("url", gallery);
  const paths = srcs.map(storagePath).filter((p): p is string => !!p);
  if (paths.length) await ctx.supabase.storage.from(BUCKET).remove(paths);
  await ctx.supabase.from("media_assets").delete().in("public_url", srcs);
}

export async function refreshProjectSite(ctx: AdminContext, p: ProjectSiteRow, opts: { url?: string; replace?: boolean; force?: boolean } = {}): Promise<RefreshResult> {
  const old = p.site_preview;
  const url = normaliseSiteUrl(opts.url ?? old?.url ?? p.project_url ?? "");
  if (!url) return { ok: false, error: "This project has no website address." };
  const c = await captureSite(ctx, url, p.slug, opts.force ? null : old);
  if ("error" in c) return { ok: false, error: c.error };

  if ("unchanged" in c) {
    await ctx.supabase.from("portfolio_projects").update({
      site_preview: { ...old, embeddable: c.embeddable, checkedAt: c.checkedAt },
      ...(c.embeddable ? {} : { live_preview: false }),
    }).eq("id", p.id);
    return { ok: true, changed: false, embeddable: c.embeddable, shots: 0, title: p.title };
  }

  const pv = c.preview;
  const patch: Record<string, unknown> = {
    project_url: pv.url, site_preview: pv,
    // Live preview follows the site: off when it blocks embedding, back on when it starts allowing it.
    live_preview: pv.embeddable && (p.live_preview !== false || old?.embeddable === false),
  };
  if (!p.discipline) patch.discipline = "software-engineering";
  if (opts.replace || !p.short_description) patch.short_description = pv.description?.slice(0, 300) ?? p.short_description;
  // The cover follows the site unless you chose your own image.
  const coverFollows = opts.replace || !p.cover_image_url || p.cover_image_url === old?.hero?.src;
  if (coverFollows) { patch.cover_image_url = pv.hero.src; patch.cover_image_alt = `${captureTitle(c)}: home page`; }
  if (opts.replace) patch.title = captureTitle(c);
  if (!p.tools?.length && c.techHints.length) patch.tools = c.techHints;

  const { error } = await ctx.supabase.from("portfolio_projects").update(patch).eq("id", p.id);
  if (error) return { ok: false, error: error.code === "42703" || error.code === "PGRST204" ? "Run migration 0017 in Supabase first, then try again." : "The project couldn't be saved." };
  if (old) await removeCapture(ctx, p.id, old, new Set(coverFollows ? [] : [p.cover_image_url ?? ""]));
  await addGalleryShots(ctx, p.id, c);
  return { ok: true, changed: true, embeddable: pv.embeddable, shots: c.sections.length + 1 + (pv.mobile ? 1 : 0) + (pv.tall ? 1 : 0), title: (patch.title as string) ?? p.title };
}
