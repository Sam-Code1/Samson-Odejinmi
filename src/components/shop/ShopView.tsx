import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ProductCard } from "@/components/academy/ProductCard";
import { NewsletterSignup } from "@/components/academy/NewsletterSignup";
import { CurrencySelector } from "@/components/academy/CurrencySelector";
import { getPublishedProducts, getShopSettings, TYPE_LABELS, type ProductCard as Card, type ProductType } from "@/lib/products";
import { getRatings } from "@/lib/reviews";
import { getShopperCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { ShopBase } from "./ProductView";

/**
 * ONE shop, two storefronts: the main site (/shop) and the Academy (/academy/shop) render this same view over the same
 * products, prices, checkout and reviews. Canonical: /shop. Search, filters and sorting are server-side (URL params),
 * so the page needs almost no JavaScript and every view is linkable.
 */
const PER_PAGE = 24;
const COPY = {
  site: { eyebrow: "The Shop", title: "Resources for learning, creating and building better.", intro: "Explore digital products, guides and learning resources created around 3D, design and creative technology." },
  academy: { eyebrow: "Shop", title: "Learn. Build. Go further.", intro: "Explore resources designed to help you understand 3D, creative technology and the tools behind the work." },
};
const TABS: { id: string; label: string; types: ProductType[] }[] = [
  { id: "ebooks", label: "Ebooks", types: ["ebook"] }, { id: "guides", label: "Guides", types: ["guide"] }, { id: "templates", label: "Templates", types: ["template"] },
  { id: "downloads", label: "Digital downloads", types: ["download"] }, { id: "courses", label: "Courses", types: ["course"] }, { id: "bundles", label: "Bundles", types: ["bundle"] },
];
const SORTS = [{ id: "featured", label: "Featured" }, { id: "newest", label: "Newest" }, { id: "price-asc", label: "Price: low to high" }, { id: "price-desc", label: "Price: high to low" }, { id: "rating", label: "Highest rated" }];

export async function shopMetadata(): Promise<Metadata> {
  const shop = await getShopSettings();
  const title = `${shop.seoTitle ?? shop.title} — Fola Academy`;
  const description = shop.seoDescription ?? shop.intro ?? COPY.site.intro;
  return { title: { absolute: title }, description, ...(shop.enabled ? {} : { robots: { index: false, follow: true } }), alternates: { canonical: "/shop" }, openGraph: { title, description, url: "/shop" } };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : v ?? "");

export async function ShopView({ base, surface, searchParams }: { base: ShopBase; surface: "site" | "academy"; searchParams: SP }) {
  const [products, shop, shopper] = await Promise.all([getPublishedProducts(), getShopSettings(), getShopperCurrency()]);
  const copy = COPY[surface];
  const wrap = (n: React.ReactNode) => <Container className="pb-20 pt-14 sm:pt-20 lg:pt-28">{n}</Container>;
  const newsletter = shop.showNewsletter && <div className="mt-16 max-w-2xl"><NewsletterSignup {...(shop.newsletterTitle ? { title: shop.newsletterTitle } : {})} {...(shop.newsletterBody ? { body: shop.newsletterBody } : {})} /></div>;
  if (!shop.enabled) {
    return wrap(<><h1 className="text-h1">{shop.title}</h1><div className="mt-12"><EmptyState title={shop.closedTitle} body={shop.closedBody} action={{ href: "/academy/courses", label: "See courses" }} /></div>{newsletter}</>);
  }

  const currency = shopper.currency;
  const ratings = await getRatings(products.map((p) => p.id));
  const tabs = TABS.filter((t) => products.some((p) => t.types.includes(p.type)));
  const tab = tabs.find((t) => t.id === one(searchParams.type));
  const q = one(searchParams.q).trim().slice(0, 80);
  const sort = SORTS.some((s) => s.id === one(searchParams.sort)) ? one(searchParams.sort) : "featured";
  const page = Math.max(1, Number.parseInt(one(searchParams.page) || "1", 10) || 1);

  const price = (p: Card) => p.prices.find((x) => x.currency === currency)?.amountMinor;
  let list = products.filter((p) => (!tab || tab.types.includes(p.type)) && (!q || `${p.name} ${p.shortDescription ?? ""} ${TYPE_LABELS[p.type]}`.toLowerCase().includes(q.toLowerCase())));
  const unpriced = (n: number | undefined) => (n === undefined ? 1 : 0);
  if (sort === "newest") list = [...list].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  if (sort === "price-asc") list = [...list].sort((a, b) => unpriced(price(a)) - unpriced(price(b)) || (price(a) ?? 0) - (price(b) ?? 0));
  if (sort === "price-desc") list = [...list].sort((a, b) => unpriced(price(a)) - unpriced(price(b)) || (price(b) ?? 0) - (price(a) ?? 0));
  if (sort === "rating") list = [...list].sort((a, b) => (ratings.get(b.id)?.average ?? 0) - (ratings.get(a.id)?.average ?? 0) || (ratings.get(b.id)?.count ?? 0) - (ratings.get(a.id)?.count ?? 0));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const featured = !tab && !q && sort === "featured" && page === 1 ? products.filter((p) => p.featured).slice(0, 3) : [];
  const href = (o: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { type: tab?.id, q: q || undefined, sort: sort === "featured" ? undefined : sort, ...o };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && String(v) === "1")) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  const card = (p: Card, i: number) => <ProductCard product={p} index={i} currency={currency} base={base} rating={ratings.get(p.id)} />;

  return wrap(
    <>
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-label text-ink-3">{copy.eyebrow}</p>
          <h1 className="mt-3 text-h1">{copy.title}</h1>
          <p className="mt-5 max-w-prose text-body-lg text-ink-2">{shop.intro ?? copy.intro}</p>
        </div>
        {products.length > 0 && <CurrencySelector current={currency} />}
      </div>

      {products.length === 0 ? (
        <div className="mt-12"><EmptyState title={shop.emptyTitle} body={shop.emptyBody} action={{ href: "/academy/courses", label: "See courses" }} /></div>
      ) : (
        <>
          {featured.length > 0 && (
            <section aria-labelledby="featured" className="mt-14">
              <h2 id="featured" className="text-h3">Featured</h2>
              <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.map((p, i) => <li key={p.id}>{card(p, i)}</li>)}</ul>
            </section>
          )}

          <section aria-labelledby="all" className="mt-14">
            <h2 id="all" className="sr-only">All products</h2>
            <div className="flex flex-col gap-4 border-b border-line pb-5 xl:flex-row xl:items-center xl:justify-between">
              <nav aria-label="Product type" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                {[{ id: "", label: "All" }, ...tabs].map((t) => {
                  const on = (tab?.id ?? "") === t.id;
                  return (
                    <Link key={t.id || "all"} href={href({ type: t.id || undefined, page: undefined })} aria-current={on ? "page" : undefined}
                      className={cn("inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-label", on ? "bg-ink text-canvas" : "border border-line text-ink-2 hover:border-ink hover:text-ink")}>{t.label}</Link>
                  );
                })}
              </nav>
              <form role="search" action={base} className="flex flex-col gap-2 sm:flex-row">
                {tab && <input type="hidden" name="type" value={tab.id} />}
                <div className="relative min-w-0 sm:w-64">
                  <label htmlFor="shop-q" className="sr-only">Search products</label>
                  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <input id="shop-q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search products"
                    className="h-11 w-full rounded border border-line-strong bg-transparent pl-9 pr-3 text-base placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
                </div>
                <label htmlFor="shop-sort" className="sr-only">Sort</label>
                <select id="shop-sort" name="sort" defaultValue={sort} className="h-11 rounded border border-line-strong bg-canvas px-3 text-base sm:text-body-sm">
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button type="submit" className="h-11 rounded border border-line-strong px-4 text-label hover:border-ink">Apply</button>
              </form>
            </div>

            {shown.length === 0 ? (
              <p className="mt-10 text-body text-ink-2">{q ? `Nothing matches "${q}".` : "Nothing in this category yet."} <Link href={base} className="underline underline-offset-4">See everything</Link></p>
            ) : (
              <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((p, i) => <li key={p.id}>{card(p, i)}</li>)}</ul>
            )}

            {pages > 1 && (
              <nav aria-label="Pages" className="mt-10 flex flex-wrap items-center gap-2">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined}
                    className={cn("grid h-11 min-w-11 place-items-center rounded px-3 text-label tabular-nums", n === page ? "bg-ink text-canvas" : "border border-line hover:border-ink")}>{n}</Link>
                ))}
              </nav>
            )}
          </section>
        </>
      )}
      {newsletter}
    </>,
  );
}
