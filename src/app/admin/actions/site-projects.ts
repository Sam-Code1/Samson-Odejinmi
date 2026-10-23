"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin, type AdminContext } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, slugify, str } from "@/lib/admin/validation";
import { logActivity, revalidateSite } from "@/lib/admin/activity";
import { captureSite, normaliseSiteUrl } from "@/lib/admin/site-capture";
import { PROJECT_SITE_COLS, addGalleryShots, captureTitle, refreshProjectSite, type ProjectSiteRow } from "@/lib/admin/site-refresh";

/**
 * Website projects ("website" permission; RLS enforces it again). Paste a link and the project fills itself in:
 * title, short description, cover, a scrolling full-page capture, a phone view and section screenshots (all HD), plus
 * whether the site can be shown live inside the case study. Your own words are never overwritten unless you ask.
 * After that, the daily job (/api/cron/site-previews) keeps the screenshots in step with the live site.
 */
const BAD_URL = "Paste the full address of a public website, e.g. https://example.com.";
const NEEDS_0017 = { ok: false, error: "Run migration 0017 in Supabase first, then try again." } as const;
const missingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

async function uniqueSlug(ctx: AdminContext, base: string) {
  const root = slugify(base) || "website";
  const { data } = await ctx.supabase.from("portfolio_projects").select("slug").like("slug", `${root}%`);
  const taken = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; i < 100; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

/** New project from a link: a draft, ready to read through and publish. */
export async function createProjectFromWebsite(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const url = normaliseSiteUrl(str(fd, "site_url", 500));
    if (!url) return { ok: false, fieldErrors: { site_url: BAD_URL } };
    const c = await captureSite(ctx, url, slugify(new URL(url).hostname) || "site");
    if ("error" in c) return { ok: false, fieldErrors: { site_url: c.error } };
    if ("unchanged" in c) return { ok: false, error: "Unexpected result. Try again." };
    const title = captureTitle(c);
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
    await addGalleryShots(ctx, data.id, c);
    await logActivity(ctx, "website project imported", "portfolio_project", data.id, title);
    revalidatePath("/admin/website/portfolio");
    redirect(`/admin/website/portfolio/${data.id}?imported=1`);
  });
}

/**
 * Refresh now: re-captures the live site in HD (always, even if it looks unchanged) and replaces the previous
 * screenshots. Title, short description and cover are filled only when empty, unless "replace" is ticked.
 */
export async function importWebsiteIntoProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing project." };
    const url = normaliseSiteUrl(str(fd, "site_url", 500));
    if (!url) return { ok: false, fieldErrors: { site_url: BAD_URL } };
    const { data: p, error: pe } = await ctx.supabase.from("portfolio_projects").select(PROJECT_SITE_COLS).eq("id", id).maybeSingle();
    if (missingColumn(pe)) return NEEDS_0017;
    if (!p) return { ok: false, error: "Project not found." };
    const r = await refreshProjectSite(ctx, p as unknown as ProjectSiteRow, { url, replace: fd.get("replace") === "on", force: true });
    if (!r.ok) return { ok: false, fieldErrors: { site_url: r.error } };
    // Auto-refresh preference (stored with the capture; no extra column needed).
    const auto = fd.get("auto_refresh") === "on";
    const { data: fresh } = await ctx.supabase.from("portfolio_projects").select("site_preview").eq("id", id).maybeSingle();
    if (fresh?.site_preview) await ctx.supabase.from("portfolio_projects").update({ site_preview: { ...(fresh.site_preview as object), autoRefresh: auto } }).eq("id", id);
    await logActivity(ctx, "website project refreshed", "portfolio_project", id, r.title);
    revalidateSite();
    revalidatePath(`/admin/website/portfolio/${id}`);
    const live = r.embeddable ? "Visitors can also try it live on the project page." : "This site blocks being shown inside other websites (its X-Frame-Options / CSP header), so visitors get the scrolling screenshots and a link instead.";
    return { ok: true, message: `Website captured in HD: ${r.shots} images. ${live}` };
  });
}
