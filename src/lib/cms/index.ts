import { cache } from "react";
import { draftMode } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient as createSessionClient, supabaseConfigured } from "@/lib/supabase/server";
import { defaultPage, defaultProjects, defaultServices, defaultSettings } from "@/content/defaults";
import type { PageContent, PageKey, PortfolioProject, Section, SectionItem, SeoEntry, SeoRouteKey, Service, SiteSettings, SocialLink } from "./types";

/**
 * Public website content: DATABASE → SERVER FETCH → CONTENT MODEL → COMPONENT.
 *
 * - Normal visitors: a cookie-less anon client, so pages stay statically cacheable. RLS returns published rows only.
 * - Admin preview (Next.js draft mode, switched on only by /api/preview after a server-side admin check): the admin's own
 *   session client, so RLS also returns drafts. Archived content is never shown.
 * - Supabase not configured, or migration 0003 not run yet: the offline defaults in src/content/defaults.ts.
 */

type Row = Record<string, unknown>;

const anon = () =>
  createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, next: { tags: ["cms"] } } as RequestInit) },
  });

export const isPreview = cache(async () => {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
});

const client = cache(async () => ((await isPreview()) ? await createSessionClient() : anon()));
const visible = async () => ((await isPreview()) ? ["published", "draft"] : ["published"]);

/** A missing table / column means the migration hasn't been applied: fall back instead of breaking the page. */
function notMigrated(error: { code?: string } | null) {
  return !!error && ["42P01", "42703", "PGRST205", "PGRST204", "PGRST202"].includes(error.code ?? "");
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

// ───────────── settings + socials ─────────────
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!supabaseConfigured) return defaultSettings;
  try {
    const { data, error } = await (await client()).from("site_settings").select("*").eq("id", true).maybeSingle();
    if (error || !data) {
      if (error && !notMigrated(error)) console.error("[cms] site_settings:", error.code, error.message);
      return defaultSettings;
    }
    const r = data as Row;
    return {
      siteName: str(r.site_name) ?? defaultSettings.siteName,
      fullName: str(r.full_name) ?? defaultSettings.fullName,
      jobTitle: str(r.job_title),
      description: str(r.site_description) ?? defaultSettings.description,
      defaultSeoTitle: str(r.default_seo_title) ?? defaultSettings.defaultSeoTitle,
      defaultSeoDescription: str(r.default_seo_description) ?? defaultSettings.defaultSeoDescription,
      logoUrl: str(r.logo_url),
      faviconUrl: str(r.favicon_url),
      defaultOgImage: str(r.default_og_image),
      contactEmail: str(r.contact_email) ?? defaultSettings.contactEmail,
      availabilityMessage: str(r.availability_message),
      responseExpectation: str(r.response_expectation),
      locationText: str(r.location_text),
      footerText: str(r.footer_text),
      copyrightText: str(r.copyright_text),
    };
  } catch {
    return defaultSettings;
  }
});

export const getSocialLinks = cache(async (): Promise<SocialLink[]> => {
  if (!supabaseConfigured) return [];
  try {
    const { data, error } = await (await client()).from("social_links").select("id, platform, label, url").eq("active", true).order("display_order").order("created_at");
    if (error || !data) return [];
    return (data as Row[]).map((r) => ({ id: r.id as string, platform: r.platform as string, label: r.label as string, url: r.url as string }));
  } catch {
    return [];
  }
});

// ───────────── page sections ─────────────
function toItems(v: unknown): SectionItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Row => !!x && typeof x === "object")
    .map((x) => ({ title: str(x.title) ?? undefined, body: str(x.body) ?? undefined, meta: str(x.meta) ?? undefined }))
    .filter((x) => x.title || x.body || x.meta);
}

export function rowToSection(r: Row): Section {
  const cta = str(r.cta_href) ? { label: (r.cta_label as string) ?? "", href: r.cta_href as string } : null;
  const cta2 = str(r.cta2_href) && str(r.cta2_label) ? { label: r.cta2_label as string, href: r.cta2_href as string } : null;
  return {
    key: r.section_key as string,
    eyebrow: str(r.eyebrow), title: str(r.title), body: str(r.body), imageUrl: str(r.image_url), imageAlt: str(r.image_alt),
    cta, cta2, items: toItems(r.items),
    settings: r.settings && typeof r.settings === "object" ? (r.settings as Record<string, unknown>) : {},
    status: r.status as Section["status"],
  };
}

export const getPage = cache(async (page: PageKey): Promise<PageContent> => {
  if (!supabaseConfigured) return defaultPage(page);
  try {
    const { data, error } = await (await client()).from("page_sections").select("*").eq("page", page).in("status", await visible()).order("display_order");
    if (error) {
      if (!notMigrated(error)) console.error("[cms] page_sections:", error.code, error.message);
      return defaultPage(page);
    }
    return Object.fromEntries((data as Row[]).map((r) => [r.section_key as string, rowToSection(r)]));
  } catch {
    return defaultPage(page);
  }
});

// ───────────── portfolio ─────────────
const PROJECT_COLS = "*, portfolio_media(id, url, alt, caption, display_order)";

function toProject(r: Row): PortfolioProject {
  const media = (Array.isArray(r.portfolio_media) ? (r.portfolio_media as Row[]) : []).sort((a, b) => Number(a.display_order) - Number(b.display_order));
  const process = Array.isArray(r.process)
    ? (r.process as Row[]).map((p) => ({ title: str(p?.title) ?? "", body: str(p?.body) ?? "" })).filter((p) => p.title || p.body)
    : [];
  const cover = str(r.cover_image_url);
  return {
    id: r.id as string, slug: r.slug as string, title: r.title as string, shortDescription: str(r.short_description) ?? "",
    description: str(r.description), challenge: str(r.challenge), approach: str(r.approach), outcome: str(r.outcome), process,
    category: str(r.category), categories: arr(r.categories).length ? arr(r.categories) : str(r.category) ? [r.category as string] : [],
    services: arr(r.services), tools: arr(r.tools),
    coverImage: cover ? { src: cover, alt: str(r.cover_image_alt) ?? (r.title as string) } : undefined,
    gallery: media.map((m) => ({ id: m.id as string, src: m.url as string, alt: str(m.alt) ?? "", caption: str(m.caption) })),
    video: r.video_provider === "youtube" && str(r.video_id) ? { provider: "youtube", id: r.video_id as string } : null,
    projectUrl: str(r.project_url), externalUrl: str(r.external_url), year: typeof r.year === "number" ? r.year : null,
    role: str(r.role), client: str(r.client), projectType: str(r.project_type), projectStatus: str(r.project_status) ?? "Personal Study",
    placeholder: r.is_placeholder === true, featured: r.featured === true, status: r.status as PortfolioProject["status"],
    seoTitle: str(r.seo_title), seoDescription: str(r.seo_description), updatedAt: str(r.updated_at),
  };
}

export const getProjects = cache(async (): Promise<PortfolioProject[]> => {
  if (!supabaseConfigured) return defaultProjects;
  try {
    const { data, error } = await (await client()).from("portfolio_projects").select(PROJECT_COLS).in("status", await visible()).order("display_order").order("created_at");
    if (error) {
      if (!notMigrated(error)) console.error("[cms] portfolio_projects:", error.code, error.message);
      return notMigrated(error) ? defaultProjects : [];
    }
    return (data as Row[]).map(toProject);
  } catch {
    return [];
  }
});

export async function getProject(slug: string) {
  return (await getProjects()).find((p) => p.slug === slug) ?? null;
}

// ───────────── services ─────────────
export const getServices = cache(async (): Promise<Service[]> => {
  if (!supabaseConfigured) return defaultServices;
  try {
    const { data, error } = await (await client()).from("services").select("*").in("status", await visible()).order("display_order").order("created_at");
    if (error) {
      if (!notMigrated(error)) console.error("[cms] services:", error.code, error.message);
      return notMigrated(error) ? defaultServices : [];
    }
    return (data as Row[]).map((r) => ({
      id: r.id as string, slug: r.slug as string, name: r.name as string, shortDescription: str(r.short_description), fullDescription: str(r.full_description),
      icon: str(r.icon), imageUrl: str(r.image_url), deliverables: arr(r.deliverables), process: arr(r.process), tools: arr(r.tools),
      relatedCategory: str(r.related_category), ctaLabel: str(r.cta_label), ctaHref: str(r.cta_href), featured: r.featured === true,
      status: r.status as Service["status"],
    }));
  } catch {
    return [];
  }
});

// ───────────── SEO ─────────────
const EMPTY_SEO: SeoEntry = { seoTitle: null, seoDescription: null, ogTitle: null, ogDescription: null, ogImage: null, canonicalUrl: null, noindex: false };

export const getSeo = cache(async (key: SeoRouteKey): Promise<SeoEntry> => {
  if (!supabaseConfigured) return EMPTY_SEO;
  try {
    const { data, error } = await anon().from("seo_metadata").select("*").eq("route_key", key).maybeSingle();
    if (error || !data) return EMPTY_SEO;
    const r = data as Row;
    return {
      seoTitle: str(r.seo_title), seoDescription: str(r.seo_description), ogTitle: str(r.og_title), ogDescription: str(r.og_description),
      ogImage: str(r.og_image), canonicalUrl: str(r.canonical_url), noindex: r.noindex === true,
    };
  } catch {
    return EMPTY_SEO;
  }
});
