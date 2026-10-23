import { cache } from "react";
import { contentClient, getProjects } from "@/lib/cms";
import type { PortfolioProject } from "@/lib/cms/types";
import { supabaseConfigured } from "@/lib/supabase/server";
import { GALLERY_SEED } from "@/content/gallery-seed";
import { GALLERY_CATEGORIES, isGalleryCategory, type GalleryItem } from "./gallery-categories";

/**
 * The portfolio gallery (migration 0016: gallery_items), server side. Categories and types live in gallery-categories.ts.
 * Before migration 0016 the built-in collection (src/content/gallery-seed.ts, files in public/work) is shown.
 */
export { GALLERY_CATEGORIES, categoryOf, isGalleryCategory, type GalleryCategory, type GalleryItem } from "./gallery-categories";

type Row = Record<string, unknown>;
const toItem = (r: Row): GalleryItem | null => {
  if (!isGalleryCategory(r.category) || typeof r.src !== "string") return null;
  return {
    id: String(r.id), slug: String(r.slug), title: String(r.title), description: (r.description as string | null) ?? null, category: r.category,
    series: (r.series as string | null) ?? null, kind: r.kind === "video" ? "video" : "image", src: r.src, poster: (r.poster as string | null) ?? null,
    width: Number(r.width) || 0, height: Number(r.height) || 0, tone: (r.tone as string | null) ?? null, featured: r.featured === true,
    position: Number(r.position) || 0, linkUrl: (r.link_url as string | null) ?? null,
  };
};

/** A published project with a discipline (e.g. a website) as a tile that opens its case study. */
const projectItem = (p: PortfolioProject): GalleryItem | null => {
  const img = p.site?.hero ?? (p.coverImage ? { src: p.coverImage.src, w: 0, h: 0 } : null);
  if (!img || !isGalleryCategory(p.discipline) || p.placeholder || p.status !== "published") return null;
  return {
    id: `project-${p.id}`, slug: p.slug, title: p.title, description: p.shortDescription || null, category: p.discipline,
    series: p.site?.domain ?? p.client ?? null, kind: "project", src: img.src, poster: null, width: img.w || 1440, height: img.h || 900,
    tone: null, featured: p.featured, position: -1, linkUrl: p.projectUrl, href: `/portfolio/${p.slug}`,
  };
};

/**
 * Published work, in admin order: gallery pieces (migration 0016) plus projects that have a discipline (migration 0017),
 * which lead their discipline. Cookie-less (cacheable); admin edits refresh it through the "cms" cache tag.
 */
export const getGallery = cache(async (): Promise<GalleryItem[]> => {
  const projects = (await getProjects().catch(() => [])).map(projectItem).filter((x): x is GalleryItem => x !== null);
  if (!supabaseConfigured) return [...projects, ...GALLERY_SEED];
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.from("gallery_items").select("*").eq("status", "published").order("position").order("created_at");
    if (error) return [...projects, ...GALLERY_SEED]; // before migration 0016
    return [...projects, ...((data ?? []) as Row[]).map(toItem).filter((x): x is GalleryItem => x !== null)];
  } catch {
    return [...projects, ...GALLERY_SEED];
  }
});

/** Items per category, in category order, with counts (for the discipline index). */
export function byCategory(items: GalleryItem[]) {
  return GALLERY_CATEGORIES.map((c) => ({ ...c, items: items.filter((i) => i.category === c.id) }));
}

/** A balanced "selected work" mix: featured pieces first, at most `perCategory` from each category. */
export function selectedWork(items: GalleryItem[], limit = 9, perCategory = 3) {
  const seen = new Map<string, number>();
  const ordered = [...items.filter((i) => i.featured), ...items.filter((i) => !i.featured)];
  const out: GalleryItem[] = [];
  for (const i of ordered) {
    const n = seen.get(i.category) ?? 0;
    if (n >= perCategory) continue;
    seen.set(i.category, n + 1);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}
