import { cache } from "react";
import { supabaseConfigured } from "@/lib/supabase/server";
import { contentClient } from "@/lib/cms";
import type { Currency, PriceRow } from "@/content/course";

/**
 * Public product catalogue (published products only, enforced by RLS). Cookie-less reads, so shop pages are cacheable;
 * admin changes refresh them through the "cms" cache tag.
 */
export const PRODUCT_TYPES = ["course", "ebook", "guide", "template", "download", "bundle"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const TYPE_LABELS: Record<ProductType, string> = {
  course: "Course", ebook: "Ebook", guide: "Guide", template: "Template", download: "Digital download", bundle: "Bundle",
};
/** Types delivered as a file through the secure download route. */
export const FILE_TYPES: ProductType[] = ["ebook", "guide", "template", "download"];

export type ProductCard = {
  id: string; slug: string; name: string; type: ProductType; shortDescription: string | null; coverImage: string | null;
  courseSlug: string | null; prices: PriceRow[]; badge: string | null; featured: boolean;
};
export type PublicProduct = ProductCard & {
  description: string | null; seoTitle: string | null; seoDescription: string | null; ogImage: string | null; updatedAt: string | null;
  items: ProductCard[]; related: ProductCard[];
  features: string[]; faq: { q: string; a: string }[]; details: { format?: string; length?: string; level?: string; includes_note?: string };
};

type Row = Record<string, unknown>;
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const isType = (v: unknown): v is ProductType => typeof v === "string" && (PRODUCT_TYPES as readonly string[]).includes(v);
const CURRENCIES: Currency[] = ["NGN", "USD", "GBP"];

const COLS = "id, slug, name, product_type, short_description, cover_image, course_id, courses(slug), product_prices(currency, amount_minor, active)";

async function coursePrices(supabase: Awaited<ReturnType<typeof contentClient>>, courseIds: string[]) {
  if (!courseIds.length) return new Map<string, PriceRow[]>();
  const { data } = await supabase.from("course_pricing").select("course_id, currency, amount_minor").in("course_id", courseIds).eq("active", true);
  const m = new Map<string, PriceRow[]>();
  for (const r of (data ?? []) as Row[]) {
    if (!CURRENCIES.includes(r.currency as Currency)) continue;
    const list = m.get(r.course_id as string) ?? [];
    list.push({ currency: r.currency as Currency, amountMinor: Number(r.amount_minor) });
    m.set(r.course_id as string, list);
  }
  return m;
}

function toCard(r: Row, cp: Map<string, PriceRow[]>, was: Map<string, number>): ProductCard | null {
  if (!isType(r.product_type)) return null;
  const own = Array.isArray(r.product_prices) ? (r.product_prices as Row[]) : [];
  const prices = r.product_type === "course"
    ? cp.get(r.course_id as string) ?? []
    : own.filter((p) => p.active !== false && CURRENCIES.includes(p.currency as Currency)).map((p) => {
      const compare = was.get(`${r.id}:${p.currency}`);
      return { currency: p.currency as Currency, amountMinor: Number(p.amount_minor), ...(compare && compare > Number(p.amount_minor) ? { compareAtMinor: compare } : {}) };
    });
  const course = r.courses as { slug?: string } | null;
  return {
    id: r.id as string, slug: r.slug as string, name: r.name as string, type: r.product_type, shortDescription: s(r.short_description),
    coverImage: s(r.cover_image), courseSlug: course?.slug ?? null, prices: prices.sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency)),
    badge: s(r.badge), featured: r.featured === true,
  };
}

/** "Was" prices (migration 0012). Separate, optional read: before 0012 the column is missing and nothing is shown. */
async function compareAt(supabase: Awaited<ReturnType<typeof contentClient>>, ids: string[]) {
  const m = new Map<string, number>();
  if (!ids.length) return m;
  const { data, error } = await supabase.from("product_prices").select("product_id, currency, compare_at_minor").in("product_id", ids).not("compare_at_minor", "is", null);
  if (error) return m;
  for (const r of (data ?? []) as Row[]) m.set(`${r.product_id}:${r.currency}`, Number(r.compare_at_minor));
  return m;
}

async function cards(rows: Row[]) {
  const supabase = await contentClient();
  const [cp, was] = await Promise.all([
    coursePrices(supabase, rows.filter((r) => r.product_type === "course").map((r) => r.course_id as string)),
    compareAt(supabase, rows.filter((r) => r.product_type !== "course").map((r) => r.id as string)),
  ]);
  return rows.map((r) => toCard(r, cp, was)).filter((c): c is ProductCard => c !== null);
}

export const getPublishedProducts = cache(async (): Promise<ProductCard[]> => {
  if (!supabaseConfigured) return [];
  try {
    const supabase = await contentClient();
    // Shop order (migration 0009): featured first, then the admin's order, then newest. Falls back before 0009.
    let res = await supabase.from("products").select(`${COLS}, badge, featured, display_order`).eq("status", "published")
      .order("featured", { ascending: false }).order("display_order").order("published_at", { ascending: false, nullsFirst: false });
    if (res.error) res = await supabase.from("products").select(COLS).eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }) as typeof res;
    if (res.error || !res.data) return [];
    return cards(res.data as Row[]);
  } catch {
    return [];
  }
});

export const getProduct = cache(async (slug: string): Promise<PublicProduct | null> => {
  if (!supabaseConfigured || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const supabase = await contentClient();
    const cols = `${COLS}, description, seo_title, seo_description, og_image, updated_at`;
    let res = await supabase.from("products").select(`${cols}, badge, featured, features, faq, details`).eq("slug", slug).eq("status", "published").maybeSingle();
    if (res.error) res = await supabase.from("products").select(cols).eq("slug", slug).eq("status", "published").maybeSingle() as typeof res;
    const r = res.data;
    if (!r) return null;
    const row = r as Row;
    const [{ data: items }, { data: rel }] = await Promise.all([
      supabase.from("bundle_items").select(`position, products!bundle_items_product_id_fkey(${COLS})`).eq("bundle_id", row.id as string).order("position"),
      supabase.from("related_products").select(`position, products!related_products_related_id_fkey(${COLS})`).eq("product_id", row.id as string).order("position"),
    ]);
    const pick = (list: unknown) => ((list ?? []) as { products: Row | null }[]).map((x) => x.products).filter((x): x is Row => !!x && x.status !== "draft");
    const [base] = await cards([row]);
    if (!base) return null;
    return {
      ...base, description: s(row.description), seoTitle: s(row.seo_title), seoDescription: s(row.seo_description), ogImage: s(row.og_image),
      updatedAt: s(row.updated_at), items: await cards(pick(items)), related: await cards(pick(rel)),
      features: Array.isArray(row.features) ? (row.features as unknown[]).filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 20) : [],
      faq: Array.isArray(row.faq) ? (row.faq as Row[]).filter((x) => typeof x?.q === "string" && typeof x?.a === "string").map((x) => ({ q: x.q as string, a: x.a as string })).slice(0, 12) : [],
      details: row.details && typeof row.details === "object" ? Object.fromEntries(Object.entries(row.details as Row).filter(([k, v]) => ["format", "length", "level", "includes_note"].includes(k) && typeof v === "string" && v)) as PublicProduct["details"] : {},
    };
  } catch {
    return null;
  }
});

export type ShopSettings = { enabled: boolean; closedTitle: string; closedBody: string; title: string; intro: string | null; seoTitle: string | null; seoDescription: string | null; emptyTitle: string; emptyBody: string; showNewsletter: boolean; newsletterTitle: string | null; newsletterBody: string | null };
const SHOP_DEFAULTS: ShopSettings = {
  enabled: true, closedTitle: "The shop is closed for now", closedBody: "Ebooks and guides will be back soon. Everything you've already bought is still in your library.",
  title: "Shop", intro: "Ebooks, guides, templates and courses. Everything you buy stays in your library.", seoTitle: null, seoDescription: null,
  emptyTitle: "Nothing here yet", emptyBody: "The first guides and ebooks are being prepared. Leave your email below and we'll tell you when they're ready.",
  showNewsletter: true, newsletterTitle: null, newsletterBody: null,
};

/**
 * Shop page copy and the open/closed switch from Admin → Products → Shop settings (0009, switch in 0010); the
 * built-in copy before that. Closing the shop is also enforced by the database (no new product checkouts).
 */
export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  if (!supabaseConfigured) return SHOP_DEFAULTS;
  try {
    const supabase = await contentClient();
    const { data, error } = await supabase.from("shop_settings").select("*").eq("id", true).maybeSingle();
    if (error || !data) return SHOP_DEFAULTS;
    const r = data as Row;
    return {
      enabled: r.enabled !== false, closedTitle: s(r.closed_title) ?? SHOP_DEFAULTS.closedTitle, closedBody: s(r.closed_body) ?? SHOP_DEFAULTS.closedBody,
      title: s(r.title) ?? SHOP_DEFAULTS.title, intro: s(r.intro), seoTitle: s(r.seo_title), seoDescription: s(r.seo_description),
      emptyTitle: s(r.empty_title) ?? SHOP_DEFAULTS.emptyTitle, emptyBody: s(r.empty_body) ?? SHOP_DEFAULTS.emptyBody,
      showNewsletter: r.show_newsletter !== false, newsletterTitle: s(r.newsletter_title), newsletterBody: s(r.newsletter_body),
    };
  } catch {
    return SHOP_DEFAULTS;
  }
});
