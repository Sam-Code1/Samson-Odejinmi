"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin, type AdminContext } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { GAME_CHARS, introWords } from "@/lib/showcase";
import { EMAIL_RE, SLUG_RE, bool, httpUrl, isUuid, lines, list, optStr, parseYouTubeId, safeHref, safeImageUrl, slugify, str } from "@/lib/admin/validation";
import { resolveImageField } from "@/lib/admin/storage";
import { logActivity, revalidateSite } from "@/lib/admin/activity";
import { sectionDef } from "@/lib/admin/sections";
import { isGalleryCategory } from "@/lib/gallery-categories";

type FieldErrors = Record<string, string>;
const STATUSES = ["draft", "published", "archived"] as const;
const PAGE_ROUTES: Record<string, string> = { home: "homepage", about: "about", services: "services", contact: "contact", portfolio: "portfolio" };

/** Parses a RepeaterField's JSON. Only the declared fields survive; everything is trimmed and length-limited. */
function parseItems(raw: string, allowed: { title?: string; body?: string; meta?: string }, max: number): { items: Record<string, string>[] } | { error: string } {
  let data: unknown;
  try { data = JSON.parse(raw || "[]"); } catch { return { error: "The list couldn't be read. Reload the page and try again." }; }
  if (!Array.isArray(data)) return { error: "The list couldn't be read." };
  if (data.length > max) return { error: `Keep this list to ${max} items or fewer.` };
  const items: Record<string, string>[] = [];
  for (const [i, x] of data.entries()) {
    if (!x || typeof x !== "object") continue;
    const out: Record<string, string> = {};
    for (const k of ["title", "body", "meta"] as const) {
      if (!allowed[k]) continue;
      const v = (x as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, k === "body" ? 600 : 160);
    }
    if (!Object.keys(out).length) continue;
    if (allowed.title && !out.title) return { error: `Item ${i + 1} needs a ${allowed.title.toLowerCase()}.` };
    items.push(out);
  }
  return { items };
}

/**
 * WhatsApp number, normalised to international digits (wa.me format). Only read when the form sent the field, which it
 * does only once migration 0007 has added the columns, so saving still works on databases without them.
 */
function whatsappPatch(fd: FormData, errors: FieldErrors): Record<string, unknown> {
  if (!fd.has("whatsapp_number")) return {};
  const raw = str(fd, "whatsapp_number", 40);
  const digits = raw.replace(/[\s().-]/g, "").replace(/^\+/, "").replace(/^00/, "");
  let whatsapp_number: string | null = null;
  if (raw) {
    if (!/^\d+$/.test(digits)) errors.whatsapp_number = "Use digits only, e.g. +234 801 234 5678.";
    else if (digits.startsWith("0")) errors.whatsapp_number = "Include the country code, e.g. +234 801 234 5678 instead of 0801 234 5678.";
    else if (!/^[1-9]\d{7,14}$/.test(digits)) errors.whatsapp_number = "That doesn't look like a full international number.";
    else whatsapp_number = digits;
  }
  return { whatsapp_number, whatsapp_message: optStr(fd, "whatsapp_message", 300) };
}

function parseCta(fd: FormData, prefix: "cta" | "cta2", errors: FieldErrors) {
  const label = str(fd, `${prefix}_label`, 60);
  const rawHref = str(fd, `${prefix}_href`, 500);
  const href = safeHref(rawHref);
  if (rawHref && !href) errors[`${prefix}_href`] = "Use a site path like /contact, a full https:// link, or mailto:.";
  if (label && !rawHref) errors[`${prefix}_href`] = "Add where the button should go.";
  return { label: label || null, href: href ?? null };
}

// ═════════════════════════ PAGE SECTIONS ═════════════════════════
export async function saveSection(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "sectionId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing section." };
    const { data: row } = await ctx.supabase.from("page_sections").select("page, section_key, label, settings").eq("id", id).maybeSingle();
    if (!row) return { ok: false, error: "That section no longer exists." };
    const def = sectionDef(row.page as string, row.section_key as string);
    const errors: FieldErrors = {};
    const patch: Record<string, unknown> = { updated_by: ctx.user.id };

    if (def.fields.includes("eyebrow")) patch.eyebrow = optStr(fd, "eyebrow", 160);
    if (def.fields.includes("title")) patch.title = optStr(fd, "title", 400);
    if (def.fields.includes("body")) patch.body = optStr(fd, "body", 6000);
    if (def.fields.includes("cta")) { const c = parseCta(fd, "cta", errors); patch.cta_label = c.label; patch.cta_href = c.href; }
    if (def.fields.includes("cta2")) { const c = parseCta(fd, "cta2", errors); patch.cta2_label = c.label; patch.cta2_href = c.href; }
    if (def.fields.includes("image")) {
      const img = await resolveImageField(ctx, fd, "image", "site_image");
      if (!img.ok) errors.image = img.error;
      else if (img.url !== undefined) patch.image_url = img.url;
      patch.image_alt = optStr(fd, "image_alt", 200);
    }
    if (def.items) {
      const parsed = parseItems(str(fd, "items", 40000), def.items.fields, def.items.max);
      if ("error" in parsed) errors.items = parsed.error; else patch.items = parsed.items;
    }
    if (def.settings) {
      const settings = { ...((row.settings as Record<string, unknown>) ?? {}) };
      if (def.settings.includes("scene_url")) {
        const v = str(fd, "scene_url", 300);
        if (v && !/^https:\/\/prod\.spline\.design\/[A-Za-z0-9_-]+\/scene\.splinecode$/.test(v)) errors.scene_url = "Use a public Spline scene URL: https://prod.spline.design/<id>/scene.splinecode";
        settings.scene_url = v;
      }
      if (def.settings.includes("featured_course_slug")) {
        const v = str(fd, "featured_course_slug", 80);
        if (v && !SLUG_RE.test(v)) errors.featured_course_slug = "Choose a course from the list.";
        settings.featured_course_slug = v;
      }
      if (def.settings.includes("backdrop_word")) {
        const v = str(fd, "backdrop_word", 40);
        if (v && (/\s/.test(v) || v.length > 12)) errors.backdrop_word = "Use one word of up to 12 letters.";
        settings.backdrop_word = v;
      }
      if (def.settings.includes("intro_words")) {
        const v = str(fd, "intro_words", 200);
        const words = introWords(v);
        if (v && v.split(/\r?\n/).filter((w) => w.trim()).length > 3) errors.intro_words = "Use up to 3 lines.";
        else if (words.some((w) => w.length > 13)) errors.intro_words = "Keep each word to 13 characters or fewer so it fits on phones.";
        settings.intro_words = words.join("\n");
      }
      if (def.settings.includes("game_text")) {
        const v = str(fd, "game_text", 60);
        const lines = v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!v) errors.game_text = "Enter the text the bricks should spell.";
        else if (lines.length > 2 || lines.some((l) => l.length > 7)) errors.game_text = "Up to 2 lines of 7 characters.";
        else if (lines.some((l) => [...l.toUpperCase()].some((c) => !GAME_CHARS.includes(c)))) errors.game_text = "Use letters, numbers, spaces and ! ? . - only.";
        settings.game_text = lines.join("\n").toUpperCase();
      }
      patch.settings = settings;
    }
    const status = str(fd, "status", 12);
    if (!(STATUSES as readonly string[]).includes(status)) errors.status = "Choose a status.";
    patch.status = status;
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

    const { error } = await ctx.supabase.from("page_sections").update(patch).eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, `${row.page} section updated`, "page_section", id, `${row.page} · ${row.label}`);
    revalidateSite();
    revalidatePath(`/admin/website/${PAGE_ROUTES[row.page as string] ?? ""}`);
    return { ok: true, message: `“${row.label}” saved.` };
  });
}

export async function moveSection(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "sectionId", 40), dir = str(fd, "dir", 4);
    if (!isUuid(id) || !["up", "down"].includes(dir)) return { ok: false, error: "That move isn't valid." };
    const { data: row } = await ctx.supabase.from("page_sections").select("page").eq("id", id).maybeSingle();
    if (!row) return { ok: false, error: "Section not found." };
    const { data: all } = await ctx.supabase.from("page_sections").select("id").eq("page", row.page).order("display_order").order("created_at");
    const ids = (all ?? []).map((x) => x.id as string);
    const i = ids.indexOf(id), j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const results = await Promise.all(ids.map((sid, k) => ctx.supabase.from("page_sections").update({ display_order: (k + 1) * 10 }).eq("id", sid)));
    const failed = results.find((r) => r.error);
    if (failed) return dbError(failed.error);
    revalidateSite();
    return { ok: true, message: "Section moved." };
  });
}

// ═════════════════════════ SITE SETTINGS ═════════════════════════
export async function saveSiteSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const errors: FieldErrors = {};
    const site_name = str(fd, "site_name", 80), full_name = str(fd, "full_name", 120);
    if (!site_name) errors.site_name = "Site name is required.";
    if (!full_name) errors.full_name = "Full name is required.";
    const contact_email = str(fd, "contact_email", 200);
    if (!EMAIL_RE.test(contact_email)) errors.contact_email = "Enter a valid email address.";
    const patch: Record<string, unknown> = {
      site_name, full_name, contact_email,
      job_title: optStr(fd, "job_title", 120), site_description: optStr(fd, "site_description", 300),
      default_seo_title: optStr(fd, "default_seo_title", 80), default_seo_description: optStr(fd, "default_seo_description", 200),
      footer_text: optStr(fd, "footer_text", 300), copyright_text: optStr(fd, "copyright_text", 120),
      availability_message: optStr(fd, "availability_message", 200), response_expectation: optStr(fd, "response_expectation", 200),
      location_text: optStr(fd, "location_text", 120),
      ...whatsappPatch(fd, errors),
    };
    for (const [field, kind] of [["logo_url", "logo"], ["favicon_url", "logo"], ["default_og_image", "og_image"]] as const) {
      const r = await resolveImageField(ctx, fd, field, kind);
      if (!r.ok) errors[field] = r.error; else if (r.url !== undefined) patch[field] = r.url;
    }
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { error } = await ctx.supabase.from("site_settings").update(patch).eq("id", true);
    if (error) return dbError(error);
    await logActivity(ctx, "site settings updated", "site_settings", null, "Site settings");
    revalidateSite();
    return { ok: true, message: "Site settings saved." };
  });
}

/** Contact page details live in site_settings; this saves only the contact-related fields. */
export async function saveContactSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const contact_email = str(fd, "contact_email", 200);
    const errors: FieldErrors = {};
    if (!EMAIL_RE.test(contact_email)) errors.contact_email = "Enter a valid email address.";
    const wa = whatsappPatch(fd, errors);
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { error } = await ctx.supabase.from("site_settings").update({
      contact_email, availability_message: optStr(fd, "availability_message", 200), response_expectation: optStr(fd, "response_expectation", 200),
      location_text: optStr(fd, "location_text", 120), ...wa,
    }).eq("id", true);
    if (error) return dbError(error);
    await logActivity(ctx, "contact details updated", "site_settings", null, "Contact details");
    revalidateSite();
    return { ok: true, message: "Contact details saved." };
  });
}

// ═════════════════════════ SOCIAL LINKS ═════════════════════════
const PLATFORMS = ["linkedin", "x", "instagram", "youtube", "pinterest", "github", "behance", "artstation", "vimeo", "tiktok", "facebook", "email", "website", "other"];

export async function saveSocialLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "linkId", 40);
    const platform = str(fd, "platform", 20), label = str(fd, "label", 60), raw = str(fd, "url", 500);
    const errors: FieldErrors = {};
    if (!PLATFORMS.includes(platform)) errors.platform = "Choose a platform.";
    if (!label) errors.label = "Label is required.";
    let url: string | null = null;
    if (platform === "email") url = EMAIL_RE.test(raw.replace(/^mailto:/i, "")) ? `mailto:${raw.replace(/^mailto:/i, "")}` : null;
    else { const u = httpUrl(raw); url = u && u.startsWith("https:") ? u : null; }
    if (!url) errors.url = platform === "email" ? "Enter a valid email address." : "Enter the full profile link, starting with https://";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const row = { platform, label, url, active: bool(fd, "active") };
    if (isUuid(id)) {
      const { error } = await ctx.supabase.from("social_links").update(row).eq("id", id);
      if (error) return dbError(error);
    } else {
      const { data: last } = await ctx.supabase.from("social_links").select("display_order").order("display_order", { ascending: false }).limit(1);
      const { error } = await ctx.supabase.from("social_links").insert({ ...row, display_order: ((last?.[0]?.display_order as number) ?? 0) + 10 });
      if (error) return dbError(error);
    }
    await logActivity(ctx, isUuid(id) ? "social link updated" : "social link added", "social_link", isUuid(id) ? id : null, label);
    revalidateSite();
    revalidatePath("/admin/website/social");
    return { ok: true, message: "Social link saved." };
  });
}

export async function deleteSocialLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "linkId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing link." };
    const { error } = await ctx.supabase.from("social_links").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "social link deleted", "social_link", id);
    revalidateSite();
    revalidatePath("/admin/website/social");
    return { ok: true, message: "Social link removed." };
  });
}

export async function moveSocialLink(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return reorder(fd, "social_links", "linkId", "/admin/website/social");
}

/** Generic up/down reorder for tables with a display_order column (rewrites orders as 10, 20, 30…). */
async function reorder(fd: FormData, table: "social_links" | "portfolio_projects" | "services" | "portfolio_media", idField: string, path: string, scope?: { column: string; value: string }) {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, idField, 40), dir = str(fd, "dir", 4);
    if (!isUuid(id) || !["up", "down"].includes(dir)) return { ok: false, error: "That move isn't valid." };
    let q = ctx.supabase.from(table).select("id").order("display_order").order("created_at");
    if (scope) q = q.eq(scope.column, scope.value);
    const { data: all, error: le } = await q;
    if (le) return dbError(le);
    const ids = (all ?? []).map((x) => x.id as string);
    const i = ids.indexOf(id), j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const results = await Promise.all(ids.map((rid, k) => ctx.supabase.from(table).update({ display_order: (k + 1) * 10 }).eq("id", rid)));
    const failed = results.find((r) => r.error);
    if (failed) return dbError(failed.error);
    revalidateSite();
    revalidatePath(path);
    return { ok: true, message: "Order updated." };
  });
}

// ═════════════════════════ SEO ═════════════════════════
const SEO_ROUTES = ["home", "about", "portfolio", "services", "contact", "academy", "academy_courses"];

export async function saveSeoEntry(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const key = str(fd, "route_key", 30);
    if (!SEO_ROUTES.includes(key)) return { ok: false, error: "Unknown page." };
    const errors: FieldErrors = {};
    const canonicalRaw = str(fd, "canonical_url", 500);
    const canonical = canonicalRaw ? (canonicalRaw.startsWith("/") ? safeHref(canonicalRaw) : httpUrl(canonicalRaw)) : null;
    if (canonicalRaw && !canonical) errors.canonical_url = "Use a path like /about or a full https:// URL.";
    const ogRaw = str(fd, "og_image_url", 500);
    let og_image: string | null | undefined = undefined;
    const img = await resolveImageField(ctx, fd, "og_image", "og_image");
    if (!img.ok) errors.og_image = img.error; else og_image = img.url;
    if (ogRaw && og_image === undefined) { og_image = safeImageUrl(ogRaw); if (!og_image) errors.og_image = "Use an https:// image URL."; }
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const patch: Record<string, unknown> = {
      seo_title: optStr(fd, "seo_title", 70), seo_description: optStr(fd, "seo_description", 170), og_title: optStr(fd, "og_title", 90),
      og_description: optStr(fd, "og_description", 200), canonical_url: canonical, noindex: bool(fd, "noindex"),
    };
    if (og_image !== undefined) patch.og_image = og_image;
    const { error } = await ctx.supabase.from("seo_metadata").update(patch).eq("route_key", key);
    if (error) return dbError(error);
    await logActivity(ctx, "SEO updated", "seo", key, key);
    revalidateSite();
    return { ok: true, message: "SEO saved." };
  });
}

// ═════════════════════════ CONTACT MESSAGES ═════════════════════════
export async function setMessageStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "messageId", 40), to = str(fd, "to", 10);
    if (!isUuid(id) || !["new", "read", "replied", "archived"].includes(to)) return { ok: false, error: "That change isn't valid." };
    const { error } = await ctx.supabase.from("contact_messages").update({ status: to, read_at: to === "new" ? null : new Date().toISOString() }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/website/messages");
    revalidatePath("/admin");
    return { ok: true, message: to === "archived" ? "Message archived." : to === "read" ? "Marked as read." : "Marked as unread." };
  });
}

export async function deleteMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "messageId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing message." };
    const { error } = await ctx.supabase.from("contact_messages").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "contact message deleted", "contact_message", id);
    revalidatePath("/admin/website/messages");
    return { ok: true, message: "Message deleted." };
  });
}

// ═════════════════════════ PORTFOLIO ═════════════════════════
async function parseProject(ctx: AdminContext, fd: FormData) {
  const errors: FieldErrors = {};
  const title = str(fd, "title", 140);
  if (!title) errors.title = "Project title is required.";
  const slug = slugify(str(fd, "slug", 80) || title);
  if (!slug) errors.slug = "Slug is required (letters, numbers and hyphens).";
  const yearRaw = str(fd, "year", 4);
  if (yearRaw && (!/^\d{4}$/.test(yearRaw) || +yearRaw < 1990 || +yearRaw > 2100)) errors.year = "Enter a four-digit year, or leave it empty.";
  const urlField = (k: string) => {
    const raw = str(fd, k, 500);
    if (!raw) return null;
    const u = httpUrl(raw);
    if (!u || !u.startsWith("https:")) { errors[k] = "Use a full link starting with https://"; return null; }
    return u;
  };
  const videoRaw = str(fd, "video_input", 400);
  const videoId = videoRaw ? parseYouTubeId(videoRaw) : null;
  if (videoRaw && !videoId) errors.video_input = "Paste a YouTube link or the 11-character video ID.";
  const proc = parseItems(str(fd, "process", 20000), { title: "Step title", body: "Description" }, 12);
  if ("error" in proc) errors.process = proc.error;
  const cover = await resolveImageField(ctx, fd, "cover", "portfolio");
  if (!cover.ok) errors.cover = cover.error;
  const categories = list(fd, "categories", 8, 60);
  const projectStatus = str(fd, "project_status", 40) || "Personal Study";
  const discipline = str(fd, "discipline", 40);
  if (discipline && !isGalleryCategory(discipline)) errors.discipline = "Choose a discipline.";

  const patch: Record<string, unknown> = {
    title, slug, short_description: optStr(fd, "short_description", 300), description: optStr(fd, "description", 8000),
    challenge: optStr(fd, "challenge", 4000), approach: optStr(fd, "approach", 4000), outcome: optStr(fd, "outcome", 4000),
    process: "error" in proc ? [] : proc.items, category: categories[0] ?? null, categories,
    services: list(fd, "services", 12, 80), tools: list(fd, "tools", 20, 60),
    cover_image_alt: optStr(fd, "cover_image_alt", 200),
    video_provider: videoId ? "youtube" : "none", video_id: videoId,
    project_url: urlField("project_url"), external_url: urlField("external_url"), year: yearRaw ? Number(yearRaw) : null,
    role: optStr(fd, "role", 120), client: optStr(fd, "client", 120), project_type: optStr(fd, "project_type", 60),
    project_status: projectStatus, is_placeholder: bool(fd, "is_placeholder"), featured: bool(fd, "featured"),
    seo_title: optStr(fd, "seo_title", 70), seo_description: optStr(fd, "seo_description", 170),
  };
  // Migration 0017 fields: only sent when the form has them, so saving still works before the migration runs.
  if (fd.has("discipline")) patch.discipline = discipline || null;
  if (fd.has("live_preview_field")) patch.live_preview = bool(fd, "live_preview");
  if (cover.ok && cover.url !== undefined) patch.cover_image_url = cover.url;
  return { errors, patch, title };
}

export async function createProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const title = str(fd, "title", 140);
    if (!title) return { ok: false, fieldErrors: { title: "Project title is required." } };
    const slug = slugify(str(fd, "slug", 80) || title);
    if (!slug) return { ok: false, fieldErrors: { slug: "Slug can only contain letters, numbers and hyphens." } };
    const { data: last } = await ctx.supabase.from("portfolio_projects").select("display_order").order("display_order", { ascending: false }).limit(1);
    const { data, error } = await ctx.supabase.from("portfolio_projects").insert({
      title, slug, project_type: optStr(fd, "project_type", 60), project_status: str(fd, "project_status", 40) || "Personal Study",
      status: "draft", display_order: ((last?.[0]?.display_order as number) ?? 0) + 10,
    }).select("id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another project already uses that slug." } };
    if (error || !data) return dbError(error);
    await logActivity(ctx, "portfolio project created", "portfolio_project", data.id, title);
    revalidatePath("/admin/website/portfolio");
    redirect(`/admin/website/portfolio/${data.id}`);
  });
}

export async function saveProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing project." };
    const { errors, patch, title } = await parseProject(ctx, fd);
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const intent = str(fd, "intent", 12);
    if (intent === "publish") patch.status = "published";
    if (intent === "unpublish") patch.status = "draft";
    const { error } = await ctx.supabase.from("portfolio_projects").update(patch).eq("id", id);
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another project already uses that slug." } };
    if (error) return dbError(error);
    await logActivity(ctx, intent === "publish" ? "portfolio project published" : intent === "unpublish" ? "portfolio project unpublished" : "portfolio project updated", "portfolio_project", id, title);
    revalidateSite();
    revalidatePath(`/admin/website/portfolio/${id}`);
    return { ok: true, message: intent === "publish" ? "Project published." : intent === "unpublish" ? "Project moved to draft." : "Project saved." };
  });
}

export async function setProjectStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40), to = str(fd, "to", 12);
    if (!isUuid(id) || !(STATUSES as readonly string[]).includes(to)) return { ok: false, error: "That change isn't valid." };
    const { data, error } = await ctx.supabase.from("portfolio_projects").update({ status: to }).eq("id", id).select("title").single();
    if (error || !data) return dbError(error);
    await logActivity(ctx, `portfolio project ${to === "published" ? "published" : to === "archived" ? "archived" : "moved to draft"}`, "portfolio_project", id, data.title as string);
    revalidateSite();
    revalidatePath("/admin/website/portfolio");
    return { ok: true, message: to === "published" ? "Project published." : to === "archived" ? "Project archived." : "Project moved to draft." };
  });
}

export async function toggleProjectFeatured(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing project." };
    const on = str(fd, "on", 5) === "yes";
    const { error } = await ctx.supabase.from("portfolio_projects").update({ featured: on }).eq("id", id);
    if (error) return dbError(error);
    revalidateSite();
    revalidatePath("/admin/website/portfolio");
    return { ok: true, message: on ? "Shown on the homepage." : "Removed from the homepage." };
  });
}

export async function moveProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return reorder(fd, "portfolio_projects", "projectId", "/admin/website/portfolio");
}

export async function deleteProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "projectId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing project." };
    const { data } = await ctx.supabase.from("portfolio_projects").select("title").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("portfolio_projects").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "portfolio project deleted", "portfolio_project", id, (data?.title as string) ?? null);
    revalidateSite();
    revalidatePath("/admin/website/portfolio");
    redirect("/admin/website/portfolio");
  });
}

export async function addGalleryImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const projectId = str(fd, "projectId", 40);
    if (!isUuid(projectId)) return { ok: false, error: "Missing project." };
    const img = await resolveImageField(ctx, fd, "gallery", "portfolio");
    if (!img.ok) return { ok: false, fieldErrors: { gallery: img.error } };
    if (!img.url) return { ok: false, fieldErrors: { gallery: "Upload an image or choose one from the library." } };
    const alt = str(fd, "alt", 200);
    if (!alt) return { ok: false, fieldErrors: { alt: "Describe the image for people who can't see it." } };
    const { data: last } = await ctx.supabase.from("portfolio_media").select("display_order").eq("project_id", projectId).order("display_order", { ascending: false }).limit(1);
    const { error } = await ctx.supabase.from("portfolio_media").insert({ project_id: projectId, url: img.url, alt, caption: optStr(fd, "caption", 300), display_order: ((last?.[0]?.display_order as number) ?? 0) + 10 });
    if (error) return dbError(error);
    revalidateSite();
    revalidatePath(`/admin/website/portfolio/${projectId}`);
    return { ok: true, message: "Image added to the gallery." };
  });
}

export async function updateGalleryImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "mediaId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing image." };
    const alt = str(fd, "alt", 200);
    if (!alt) return { ok: false, fieldErrors: { alt: "Alt text is required." } };
    const { data, error } = await ctx.supabase.from("portfolio_media").update({ alt, caption: optStr(fd, "caption", 300) }).eq("id", id).select("project_id").single();
    if (error || !data) return dbError(error);
    revalidateSite();
    revalidatePath(`/admin/website/portfolio/${data.project_id}`);
    return { ok: true, message: "Image details saved." };
  });
}

export async function deleteGalleryImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "mediaId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing image." };
    const { data } = await ctx.supabase.from("portfolio_media").select("project_id").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("portfolio_media").delete().eq("id", id);
    if (error) return dbError(error);
    revalidateSite();
    if (data) revalidatePath(`/admin/website/portfolio/${data.project_id}`);
    return { ok: true, message: "Removed from the gallery. The file stays in the media library." };
  });
}

export async function moveGalleryImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const projectId = str(fd, "projectId", 40);
  if (!isUuid(projectId)) return { ok: false, error: "Missing project." };
  return reorder(fd, "portfolio_media", "mediaId", `/admin/website/portfolio/${projectId}`, { column: "project_id", value: projectId });
}

// ═════════════════════════ SERVICES ═════════════════════════
export async function createService(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const name = str(fd, "name", 100);
    if (!name) return { ok: false, fieldErrors: { name: "Service name is required." } };
    const slug = slugify(str(fd, "slug", 80) || name);
    if (!slug) return { ok: false, fieldErrors: { slug: "Slug can only contain letters, numbers and hyphens." } };
    const { data: last } = await ctx.supabase.from("services").select("display_order").order("display_order", { ascending: false }).limit(1);
    const { data, error } = await ctx.supabase.from("services").insert({ name, slug, status: "draft", display_order: ((last?.[0]?.display_order as number) ?? 0) + 10 }).select("id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another service already uses that slug." } };
    if (error || !data) return dbError(error);
    await logActivity(ctx, "service created", "service", data.id, name);
    revalidatePath("/admin/website/services");
    redirect(`/admin/website/services/${data.id}`);
  });
}

export async function saveService(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "serviceId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing service." };
    const errors: FieldErrors = {};
    const name = str(fd, "name", 100);
    if (!name) errors.name = "Service name is required.";
    const slug = slugify(str(fd, "slug", 80) || name);
    if (!slug) errors.slug = "Slug is required.";
    const cta = parseCta(fd, "cta", errors);
    const img = await resolveImageField(ctx, fd, "image", "site_image");
    if (!img.ok) errors.image = img.error;
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const patch: Record<string, unknown> = {
      name, slug, short_description: optStr(fd, "short_description", 400), full_description: optStr(fd, "full_description", 6000),
      icon: optStr(fd, "icon", 40), deliverables: lines(fd, "deliverables", 12, 200), process: lines(fd, "process", 12, 200),
      tools: list(fd, "tools", 20, 60), related_category: optStr(fd, "related_category", 60), cta_label: cta.label, cta_href: cta.href,
      featured: bool(fd, "featured"),
    };
    if (img.ok && img.url !== undefined) patch.image_url = img.url;
    const intent = str(fd, "intent", 12);
    if (intent === "publish") patch.status = "published";
    if (intent === "unpublish") patch.status = "draft";
    const { error } = await ctx.supabase.from("services").update(patch).eq("id", id);
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another service already uses that slug." } };
    if (error) return dbError(error);
    await logActivity(ctx, intent === "publish" ? "service published" : intent === "unpublish" ? "service unpublished" : "service updated", "service", id, name);
    revalidateSite();
    revalidatePath(`/admin/website/services/${id}`);
    return { ok: true, message: intent === "publish" ? "Service published." : intent === "unpublish" ? "Service moved to draft." : "Service saved." };
  });
}

export async function setServiceStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "serviceId", 40), to = str(fd, "to", 12);
    if (!isUuid(id) || !(STATUSES as readonly string[]).includes(to)) return { ok: false, error: "That change isn't valid." };
    const { data, error } = await ctx.supabase.from("services").update({ status: to }).eq("id", id).select("name").single();
    if (error || !data) return dbError(error);
    await logActivity(ctx, `service ${to === "published" ? "published" : to === "archived" ? "archived" : "moved to draft"}`, "service", id, data.name as string);
    revalidateSite();
    revalidatePath("/admin/website/services");
    return { ok: true, message: to === "published" ? "Service published." : to === "archived" ? "Service archived." : "Service moved to draft." };
  });
}

export async function moveService(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return reorder(fd, "services", "serviceId", "/admin/website/services");
}

export async function deleteService(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "serviceId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing service." };
    const { data } = await ctx.supabase.from("services").select("name").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("services").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "service deleted", "service", id, (data?.name as string) ?? null);
    revalidateSite();
    revalidatePath("/admin/website/services");
    redirect("/admin/website/services");
  });
}

// ═════════════════════════ MEDIA LIBRARY ═════════════════════════
export async function updateMediaDetails(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("media", async (ctx) => {
    const id = str(fd, "mediaId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing file." };
    const { error } = await ctx.supabase.from("media_assets").update({ alt_text: optStr(fd, "alt_text", 200), caption: optStr(fd, "caption", 300) }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/media");
    return { ok: true, message: "Details saved." };
  });
}

export async function setMediaArchived(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("media", async (ctx) => {
    const id = str(fd, "mediaId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing file." };
    const on = str(fd, "on", 5) === "yes";
    const { error } = await ctx.supabase.from("media_assets").update({ archived: on }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/media");
    return { ok: true, message: on ? "Archived. It's hidden from pickers but still works where it's already used." : "Restored." };
  });
}

