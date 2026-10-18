import { FILE_TYPES, PRODUCT_TYPES, TYPE_LABELS, type ProductType } from "@/lib/products";

/**
 * The student Library's ownership model. Two sources, both read with the student's OWN session (RLS: own rows only):
 *   - enrolments  → courses (the existing Academy learning system; includes courses bought, given or enrolled by admin)
 *   - entitlements → products (ebooks, guides, templates, downloads, bundles, course products)
 * Nothing here decides access: downloads re-check ownership in the database (prepare_product_download) and lessons
 * re-check enrolment. This module only shapes rows into cards.
 *
 * IMPORTANT: entitlements has TWO foreign keys to products (product_id = what you own, via_product_id = the bundle that
 * gave it). An unqualified `products(...)` embed is ambiguous and the API rejects it (PGRST201) for every user, which is
 * what broke the Library. Always embed through the named relationship below.
 */
export const ENTITLEMENT_SELECT =
  "id, source, granted_at, via_product_id, products!entitlements_product_id_fkey(id, name, slug, product_type, status, cover_image, courses(slug, title))";
export const ENROLMENT_SELECT = "course_id, status, granted_at, courses(slug, title, subtitle)";

export type LibraryCategory = "courses" | "ebooks" | "digital" | "bundles";
export const CATEGORIES: { id: "all" | LibraryCategory; label: string }[] = [
  { id: "all", label: "All" }, { id: "courses", label: "Courses" }, { id: "ebooks", label: "Ebooks & guides" },
  { id: "digital", label: "Digital products" }, { id: "bundles", label: "Bundles" },
];

/** One place to say how each product type is opened. A new type = one new entry here (and in PRODUCT_TYPES). */
const CATEGORY_OF: Record<ProductType, LibraryCategory> = {
  course: "courses", ebook: "ebooks", guide: "ebooks", template: "digital", download: "digital", bundle: "bundles",
};

export type LibraryAction = { kind: "continue" | "download" | "contents"; href: string; label: string } | null;
export type LibraryItem = {
  key: string; title: string; typeLabel: string; category: LibraryCategory; subtitle: string | null;
  origin: string; date: string | null; action: LibraryAction; coverImage: string | null;
  /** Where an owner leaves a review (products with a public page; courses and bundles aren't reviewed here). */
  reviewHref: string | null;
};

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const ORIGIN: Record<string, string> = { purchase: "Purchased", free: "Free", gift: "Gift", manual: "Added by Fola Academy", bundle: "Part of a bundle" };

export function buildLibrary(enrolments: Row[], entitlements: Row[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  const courseSlugs = new Set<string>();

  for (const e of enrolments) {
    const c = e.courses as Row | null;
    const slug = str(c?.slug);
    if (!c || !slug || courseSlugs.has(slug)) continue;
    courseSlugs.add(slug);
    items.push({
      key: `course:${slug}`, title: str(c.title) ?? "Course", typeLabel: "Course", category: "courses", subtitle: str(c.subtitle),
      origin: e.status === "completed" ? "Completed" : "Enrolled", date: str(e.granted_at), coverImage: null, reviewHref: null,
      action: { kind: "continue", href: `/learn/${slug}`, label: e.status === "completed" ? "Review course" : "Continue" },
    });
  }

  for (const e of entitlements) {
    const p = e.products as Row | null;
    const type = p?.product_type as ProductType | undefined;
    if (!p || !type || !(PRODUCT_TYPES as readonly string[]).includes(type)) continue;
    const course = p.courses as Row | null;
    // A course product is the course itself: shown once, from the enrolment it granted.
    if (type === "course") {
      const slug = str(course?.slug);
      if (!slug || courseSlugs.has(slug)) continue;
      courseSlugs.add(slug);
    }
    const id = String(p.id);
    const action: LibraryAction = FILE_TYPES.includes(type)
      ? { kind: "download", href: `/api/products/${id}/download`, label: "Download" }
      : type === "course" && str(course?.slug)
        ? { kind: "continue", href: `/learn/${str(course?.slug)}`, label: "Continue" }
        : type === "bundle"
          ? { kind: "contents", href: `/library?bundle=${id}`, label: "See what's included" }
          : null;
    items.push({
      key: `product:${id}`, title: str(p.name) ?? "Product", typeLabel: TYPE_LABELS[type], category: CATEGORY_OF[type],
      subtitle: type === "course" ? str(course?.title) : null, origin: ORIGIN[String(e.source)] ?? "Owned",
      date: str(e.granted_at), action, coverImage: str(p.cover_image),
      reviewHref: type !== "course" && type !== "bundle" && str(p.slug) ? `/shop/${str(p.slug)}#reviews` : null,
    });
  }
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Bundle contents: entitlements granted through that bundle (via_product_id). */
export function bundleChildren(entitlements: Row[], bundleId: string) {
  return new Set(entitlements.filter((e) => e.via_product_id === bundleId).map((e) => `product:${String((e.products as Row | null)?.id ?? "")}`));
}

export function filterLibrary(items: LibraryItem[], tab: string, q: string) {
  const needle = q.trim().toLowerCase();
  return items.filter((i) => (tab === "all" || i.category === tab) && (!needle || `${i.title} ${i.subtitle ?? ""} ${i.typeLabel}`.toLowerCase().includes(needle)));
}

/**
 * Only "the table doesn't exist yet" counts as not set up. Every other error (bad query, permissions, network) is a
 * real error and must be shown as one: never as an empty library.
 */
export const isMissingTable = (code: string | undefined) => code === "42P01" || code === "PGRST205";
