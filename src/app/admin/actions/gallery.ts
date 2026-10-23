"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, str } from "@/lib/admin/validation";
import { logActivity, revalidateSite } from "@/lib/admin/activity";
import { isFile, uploadImage } from "@/lib/admin/storage";
import { GALLERY_CATEGORIES, isGalleryCategory, type GalleryCategory } from "@/lib/gallery-categories";

/**
 * Portfolio gallery ("website" permission; RLS enforces it again, migration 0016).
 * Upload several pieces at once. The category is either chosen, or detected from each file's name and type
 * (you can change it afterwards). Images go to the public academy-media bucket (PNG/JPG/WebP/GIF/AVIF, 5 MB each);
 * videos (MP4/WebM, 25 MB) too. Each image's size and dominant colour are read on upload for a steady layout.
 */
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX_VIDEO = 25 * 1024 * 1024;

/** Best guess from the file name (and type). Order matters: specific words first. */
function guessCategory(name: string, type: string): GalleryCategory {
  const n = name.toLowerCase().replace(/[_.-]+/g, " ");
  if (/\b(website|web ?site|landing|web ?app|dashboard|screenshot|ui|ux|frontend|homepage)\b/.test(n)) return "software-engineering";
  if (/\b(ai|automation|automate|agent|chatbot|bot|workflow|n8n|zapier)\b/.test(n)) return "ai-automation";
  if (/\b(environment|interior|exterior|room|scene|landscape|archviz|render|house|kitchen|bedroom|street|hg)\b/.test(n)) return "environment-design";
  if (/\b(product|packshot|airpods|mouse|bottle|phone|watch|shoe|perfume|headphones?)\b/.test(n)) return "product-animation";
  if (/\b(character|rig|animation|anim|walk ?cycle|creature|fox|3d)\b/.test(n)) return "3d-animation";
  if (/\b(edit|edited video|reel|vlog|trailer|promo|tiktok|youtube)\b/.test(n) || type.startsWith("video/")) return "video-editing";
  return "graphic-design";
}

const slugify = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "work";
const titleFrom = (name: string) => name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Untitled";

async function measure(file: File): Promise<{ width: number | null; height: number | null; tone: string | null }> {
  try {
    const sharp = (await import("sharp")).default;
    const buf = Buffer.from(await file.arrayBuffer());
    const img = sharp(buf);
    const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
    const d = stats.dominant;
    return { width: meta.width ?? null, height: meta.height ?? null, tone: "#" + [d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, "0")).join("") };
  } catch {
    return { width: null, height: null, tone: null };
  }
}

export async function uploadGalleryItems(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const files = fd.getAll("files").filter(isFile);
    if (!files.length) return { ok: false, message: "Choose at least one image or video." };
    if (files.length > 20) return { ok: false, message: "Upload up to 20 files at a time." };
    const chosen = str(fd, "category", 40);
    const series = str(fd, "series", 80) || null;
    const featured = fd.get("featured") === "on";
    const { data: last } = await ctx.supabase.from("gallery_items").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    let position = Number(last?.position ?? 0);
    const done: string[] = [], failed: string[] = [];
    for (const file of files) {
      const category = isGalleryCategory(chosen) ? chosen : guessCategory(file.name, file.type);
      let src: string, kind: "image" | "video" = "image", dims: { width: number | null; height: number | null; tone: string | null } = { width: null, height: null, tone: null };
      if (VIDEO_TYPES[file.type]) {
        if (file.size > MAX_VIDEO) { failed.push(`${file.name} (videos must be 25 MB or smaller)`); continue; }
        const path = `gallery-video/${crypto.randomUUID()}.${VIDEO_TYPES[file.type]}`;
        const { error } = await ctx.supabase.storage.from("academy-media").upload(path, file, { contentType: file.type, upsert: false });
        if (error) { failed.push(`${file.name} (upload failed)`); continue; }
        src = ctx.supabase.storage.from("academy-media").getPublicUrl(path).data.publicUrl;
        kind = "video";
      } else {
        dims = await measure(file);
        const up = await uploadImage(ctx, file, "portfolio", { alt_text: titleFrom(file.name) });
        if (!up.ok) { failed.push(`${file.name} (${up.error})`); continue; }
        src = up.url;
      }
      position += 10;
      const base = slugify(file.name);
      const { error } = await ctx.supabase.from("gallery_items").insert({
        slug: `${base}-${crypto.randomUUID().slice(0, 6)}`, title: titleFrom(file.name), category, series, kind, src,
        width: dims.width, height: dims.height, tone: dims.tone, featured, status: "published", position,
      });
      if (error) { failed.push(`${file.name} (${error.code === "42P01" || error.code === "PGRST205" ? "run migration 0016" : "not saved"})`); continue; }
      done.push(`${file.name} → ${GALLERY_CATEGORIES.find((c) => c.id === category)?.label}`);
    }
    if (done.length) await logActivity(ctx, "gallery upload", "gallery_item", null, `${done.length} file${done.length === 1 ? "" : "s"}`);
    revalidateSite();
    revalidatePath("/admin/website/gallery");
    if (!done.length) return { ok: false, message: `Nothing was added. ${failed.join("; ")}` };
    return { ok: true, message: `Added ${done.length}: ${done.join(", ")}.${failed.length ? ` Not added: ${failed.join("; ")}.` : ""}` };
  });
}

export async function updateGalleryItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, message: "Invalid request." };
    const title = str(fd, "title", 160);
    const category = str(fd, "category", 40);
    const status = str(fd, "status", 20);
    const linkUrl = str(fd, "link_url", 300);
    if (!title) return { ok: false, fieldErrors: { title: "Give it a title." } };
    if (!isGalleryCategory(category)) return { ok: false, fieldErrors: { category: "Choose a category." } };
    if (!["published", "draft", "hidden"].includes(status)) return { ok: false, message: "Invalid status." };
    if (linkUrl && !/^https:\/\/[^\s]+$/.test(linkUrl)) return { ok: false, fieldErrors: { link_url: "Use a full https:// link." } };
    const position = Number.parseInt(str(fd, "position", 8) || "0", 10) || 0;
    const { error } = await ctx.supabase.from("gallery_items").update({
      title, category, status, position, featured: fd.get("featured") === "on", series: str(fd, "series", 80) || null,
      description: str(fd, "description", 600) || null, link_url: linkUrl || null,
    }).eq("id", id);
    if (error) return dbError(error, "Couldn't save. Run migration 0016 first.");
    await logActivity(ctx, "gallery item updated", "gallery_item", id, title);
    revalidateSite();
    revalidatePath("/admin/website/gallery");
    return { ok: true, message: "Saved." };
  });
}

export async function deleteGalleryItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, message: "Invalid request." };
    const { error } = await ctx.supabase.from("gallery_items").delete().eq("id", id);
    if (error) return dbError(error, "Couldn't delete.");
    await logActivity(ctx, "gallery item deleted", "gallery_item", id, "deleted");
    revalidateSite();
    revalidatePath("/admin/website/gallery");
    return { ok: true, message: "Removed from the gallery." };
  });
}
