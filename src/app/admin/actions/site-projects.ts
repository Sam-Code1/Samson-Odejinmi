"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin, type AdminContext } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, slugify, str } from "@/lib/admin/validation";
import { logActivity, revalidateSite } from "@/lib/admin/activity";
import { captureSite, normaliseSiteUrl, type Capture } from "@/lib/admin/site-capture";

/**
 * Website projects ("website" permission; RLS enforces it again). Paste a link and the project fills itself in:
 * title, short description, cover, a scrolling full-page capture, a phone view and section screenshots, plus whether
 * the site can be shown live inside the case study. Your own words are never overwritten unless you ask.
 */
const BAD_URL = "Paste the full address of a public website, e.g. https://example.com.";
const NEEDS_0017 = { ok: false, error: "Run migration 0017 in Supabase first, then try again." } as const;
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";
const titleOf = (c: Capture) => (c.preview.title ?? c.preview.domain).split(/\s[|–—·-]\s/)[0].trim().slice(0, 140) || c.preview.domain;

async function uniqueSlug(ctx: AdminContext, base: string) {
  const root = slugify(base) || "website";
  const { data } = await ctx.supabase.from("portfolio_projects").select("slug").like("slug", `${root}%`);
  const taken = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 100; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Section and phone screenshots go into the project's gallery (after anything already there). */
async function addShots(ctx: AdminContext, projectId: string, c: Capture) {
  const { data: last } = await ctx.supabase.from("portfolio_media").select("display_order").eq("project_id", projectId).order("display_order", { ascending: false }).limit(1);
  let order = Number(last?.[0]?.display_order ?? 0);
  const rows = [
    ...c.sections.map((s, i) => ({ url: s.src, alt: `${titleOf(c)}: section ${i + 2}`, caption: null })),
    ...(c.preview.mobile ? [{ url: c.preview.mobile.src, alt: `${titleOf(c)} on a phone`, caption: "On a phone" }] : []),
  ].map((r) => ({ ...r, project_id: projectId, display_order: (order += 10) }));
  if (rows.length) await ctx.supabase.from("portfolio_media").insert(rows);
}

/** New project from a link: a draft, ready to read through and publish. */
export async function createProjectFromWebsite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const url = normaliseSiteUrl(str(fd, "site_url", 500));
    if (!url) return { ok: false, fieldErrors: { site_url: BAD_URL } };
    const c = await captureSite(ctx, url, slugify(new URL(url).hostname) || "site");
    if ("error" in c) return { ok: false, fieldErrors: { site_url: c.error } };
    const title = titleOf(c);
    const { data: last } = await ctx.supabase.from("portfolio_projects").select("display_order").order("display_order", { ascending: false }).limit(1);
    const { data, error } = await ctx.supabase.from("portfolio_projects").insert({
      title, slug: await uniqueSlug(ctx, title), status: "draft", short_description: c.preview.description?.slice(0, 300) ?? null,
      categories: ["Software engineering"], category: "Software engineering", discipline: "software-engineering",
      tools: c.techHints, services: ["Web design", "Web development"], project_status: "Completed",
      project_url: c.preview.url, cover_image_url: c.preview.hero.src, cover_image_alt: `${title}: home page`,
      site_preview: c.preview, live_preview: c.preview.embeddable, display_order: ((last?.[0]?.display_order as number) ?? 0) + 10,
    }).select("id").single();
    if (missingColumn(error)) return NEEDS_0017;
    if (error || !data) return error ? dbError(error) : { ok: false, error: "The project couldn't be created." };
    await addShots(ctx, data.id, c);
    await logActivity(ctx, "website project imported", "portfolio_project", data.id, title);
    revalidatePath("/admin/website/portfolio");
    redirect(`/admin/website/portfolio/${data.id}?imported=1`);
  });
}

/**
 * Fetch (or refresh) the live website for an existing project. Screenshots and the preview are always updated; title,
 * short description and cover are filled only when empty, unless "replace" is ticked.
 */
export async function importWebsiteIntoProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing project." };
    const url = normaliseSiteUrl(str(fd, "site_url", 500));
    if (!url) return { ok: false, fieldErrors: { site_url: BAD_URL } };
    const replace = fd.get("replace") === "on";
    const { data: p, error: pe } = await ctx.supabase.from("portfolio_projects").select("slug, title, short_description, cover_image_url, tools, discipline, site_preview").eq("id", id).maybeSingle();
    if (missingColumn(pe)) return NEEDS_0017;
    if (!p) return { ok: false, error: "Project not found." };
    const c = await captureSite(ctx, url, p.slug as string);
    if ("error" in c) return { ok: false, fieldErrors: { site_url: c.error } };
    const old = p.site_preview as { hero?: { src?: string } } | null;
    const patch: Record<string, unknown> = { project_url: c.preview.url, site_preview: c.preview, live_preview: c.preview.embeddable };
    if (!p.discipline) patch.discipline = "software-engineering";
    if (replace || !p.short_description) patch.short_description = c.preview.description?.slice(0, 300) ?? p.short_description;
    // The cover follows the site unless you chose your own image.
    if (replace || !p.cover_image_url || p.cover_image_url === old?.hero?.src) { patch.cover_image_url = c.preview.hero.src; patch.cover_image_alt = `${titleOf(c)}: home page`; }
    if (replace) patch.title = titleOf(c);
    if (!(p.tools as string[] | null)?.length && c.techHints.length) patch.tools = c.techHints;
    const { error } = await ctx.supabase.from("portfolio_projects").update(patch).eq("id", id);
    if (missingColumn(error)) return NEEDS_0017;
    if (error) return dbError(error);
    // First capture: the section and phone screenshots join the gallery. Refreshes add them only when asked (no duplicates).
    if (!old || fd.get("add_screens_on") === "on") await addShots(ctx, id, c);
    await logActivity(ctx, "website project refreshed", "portfolio_project", id, (patch.title as string) ?? (p.title as string));
    revalidateSite();
    revalidatePath(`/admin/website/portfolio/${id}`);
    const live = c.preview.embeddable ? "It can also be explored live on the project page." : "This site doesn't allow being shown inside other pages, so visitors get the scrolling screenshots and a link.";
    return { ok: true, message: `Website captured: ${c.sections.length + 1 + (c.preview.mobile ? 1 : 0)} screenshots. ${live}` };
  });
}
