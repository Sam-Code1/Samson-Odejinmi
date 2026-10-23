import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { FaContainer } from "@/components/brand/Shell";
import { Pathway } from "@/components/brand/Brand";
import { CurrencySelector } from "@/components/academy/CurrencySelector";
import { NewsletterSignup } from "@/components/academy/NewsletterSignup";
import { BuyButtons } from "@/components/shop/CartClient";
import { BOOKS, BookCard, BookCover, PriceTag, bookHref, priceIn } from "./BookParts";
import { getPublishedProducts, getShopSettings, TYPE_LABELS, type ProductCard as Card, type ProductType } from "@/lib/products";
import { getRatings } from "@/lib/reviews";
import { getShopperCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Books (the Fola Academy store: ebooks, guides, templates, downloads, bundles). §16: an editorial grid of books and
 * resources, product art in frames on surface, format tags. Search, filters and sort are server-side URL params.
 */
const PER_PAGE = 24;
const TABS: { id: string; label: string; types: ProductType[] }[] = [
  { id: "ebooks", label: "Ebooks", types: ["ebook"] }, { id: "guides", label: "Guides", types: ["guide"] }, { id: "templates", label: "Templates", types: ["template"] },
  { id: "downloads", label: "Downloads", types: ["download"] }, { id: "bundles", label: "Bundles", types: ["bundle"] }, { id: "courses", label: "Courses", types: ["course"] },
];
const SORTS = [{ id: "featured", label: "Featured" }, { id: "newest", label: "Newest" }, { id: "price-asc", label: "Price: low to high" }, { id: "price-desc", label: "Price: high to low" }, { id: "rating", label: "Highest rated" }];

export async function booksMetadata(): Promise<Metadata> {
  const shop = await getShopSettings();
  const title = `${shop.seoTitle ?? "Books"} — Fola Academy`;
  const description = shop.seoDescription ?? shop.intro ?? "Books, guides and resources that explain how creative tools work, and why.";
  return { title: { absolute: title }, description, ...(shop.enabled ? {} : { robots: { index: false, follow: true } }), alternates: { canonical: BOOKS }, openGraph: { title, description, url: BOOKS } };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : v ?? "");

export async function BooksView({ searchParams }: { searchParams: SP }) {
  const [products, shop, shopper] = await Promise.all([getPublishedProducts(), getShopSettings(), getShopperCurrency()]);
  const newsletter = shop.showNewsletter && (
    <section className="border-t border-line py-16 sm:py-20"><FaContainer><div className="max-w-2xl"><NewsletterSignup {...(shop.newsletterTitle ? { title: shop.newsletterTitle } : {})} {...(shop.newsletterBody ? { body: shop.newsletterBody } : {})} /></div></FaContainer></section>
  );
  const hero = (children?: React.ReactNode) => (
    <section className="fa-blueprint border-b border-line">
      <FaContainer className="py-14 sm:py-20 lg:py-24">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl fa-rise">
            <p className="fa-label">Books · Fola Academy</p>
            <h1 className="mt-4 text-display">{shop.enabled ? "Books that explain the why." : shop.closedTitle}</h1>
            <p className="mt-6 max-w-prose text-body-lg text-ink-2">{shop.enabled ? (shop.intro ?? "Ebooks, guides and resources that teach how creative tools work, before you press the buttons.") : shop.closedBody}</p>
            <Pathway className="mt-8 max-w-xs" />
          </div>
          {children}
        </div>
      </FaContainer>
    </section>
  );
  if (!shop.enabled) return <>{hero()}{newsletter}</>;

  const currency = shopper.currency;
  const ratings = await getRatings(products.map((p) => p.id));
  const tabs = TABS.filter((t) => products.some((p) => t.types.includes(p.type)));
  const tab = tabs.find((t) => t.id === one(searchParams.type));
  const q = one(searchParams.q).trim().slice(0, 80);
  const sort = SORTS.some((s) => s.id === one(searchParams.sort)) ? one(searchParams.sort) : "featured";
  const page = Math.max(1, Number.parseInt(one(searchParams.page) || "1", 10) || 1);

  const price = (p: Card) => priceIn(p, currency)?.amountMinor;
  const unpriced = (n: number | undefined) => (n === undefined ? 1 : 0);
  let list = products.filter((p) => (!tab || tab.types.includes(p.type)) && (!q || `${p.name} ${p.shortDescription ?? ""} ${TYPE_LABELS[p.type]}`.toLowerCase().includes(q.toLowerCase())));
  if (sort === "newest") list = [...list].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  if (sort === "price-asc") list = [...list].sort((a, b) => unpriced(price(a)) - unpriced(price(b)) || (price(a) ?? 0) - (price(b) ?? 0));
  if (sort === "price-desc") list = [...list].sort((a, b) => unpriced(price(a)) - unpriced(price(b)) || (price(b) ?? 0) - (price(a) ?? 0));
  if (sort === "rating") list = [...list].sort((a, b) => (ratings.get(b.id)?.average ?? 0) - (ratings.get(a.id)?.average ?? 0) || (ratings.get(b.id)?.count ?? 0) - (ratings.get(a.id)?.count ?? 0));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const defaultView = !tab && !q && sort === "featured" && page === 1;
  const spotlight = defaultView ? (products.find((p) => p.featured && p.type !== "course") ?? products.find((p) => p.type !== "course")) : undefined;
  const grid = spotlight ? shown.filter((p) => p.id !== spotlight.id) : shown;
  const href = (o: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { type: tab?.id, q: q || undefined, sort: sort === "featured" ? undefined : sort, ...o };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && String(v) === "1")) sp.set(k, String(v));
    const s = sp.toString();
    return s ? `${BOOKS}?${s}` : BOOKS;
  };

  return (
    <>
      {hero(products.length > 0 ? <CurrencySelector current={currency} /> : null)}

      {products.length === 0 ? (
        <section className="py-20"><FaContainer>
          <div className="fa-callout max-w-2xl"><p className="fa-label !text-blue">Coming soon</p><p className="mt-2 text-h4">{shop.emptyTitle}</p><p className="mt-2 text-body text-ink-2">{shop.emptyBody}</p></div>
        </FaContainer></section>
      ) : (
        <>
          {spotlight && (
            <section aria-labelledby="spotlight" className="border-b border-line">
              <FaContainer className="grid gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-16">
                <div className="fa-dots fa-frame mx-auto w-full max-w-md rounded-[8px] border border-line px-[14%] py-[9%] lg:col-span-5">
                  <BookCover name={spotlight.name} image={spotlight.coverImage} type={spotlight.type} priority sizes="(min-width: 1024px) 26rem, 80vw" />
                </div>
                <div className="lg:col-span-6 lg:col-start-7">
                  <p className="fa-label">Featured · {TYPE_LABELS[spotlight.type]}</p>
                  <h2 id="spotlight" className="mt-4 text-h1"><Link href={bookHref(spotlight)} className="hover:text-blue">{spotlight.name}</Link></h2>
                  {spotlight.shortDescription && <p className="fa-quote mt-5 max-w-prose text-[1.375rem] leading-snug text-ink-2">{spotlight.shortDescription}</p>}
                  <p className="mt-8 text-h3"><PriceTag p={spotlight} currency={currency} /></p>
                  <div className="mt-6 max-w-md"><BuyButtons itemKey={`p:${spotlight.id}`} owned={false} ownedHref="/library" ownedLabel="Open your library" available={!!priceIn(spotlight, currency)} /></div>
                  <Link href={bookHref(spotlight)} className="fa-btn fa-btn-text mt-2">Read more about this book<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
                </div>
              </FaContainer>
            </section>
          )}

          {/* Only one book and it's already in the spotlight: no empty "all books" grid under it. */}
          {!(spotlight && grid.length === 0) && <section aria-labelledby="all-books" className="py-14 sm:py-20">
            <FaContainer>
              <h2 id="all-books" className="sr-only">All books</h2>
              <div className="flex flex-col gap-4 border-b border-line pb-5 xl:flex-row xl:items-center xl:justify-between">
                <nav aria-label="Format" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
                  {[{ id: "", label: "All" }, ...tabs].map((t) => {
                    const on = (tab?.id ?? "") === t.id;
                    return (
                      <Link key={t.id || "all"} href={href({ type: t.id || undefined, page: undefined })} aria-current={on ? "page" : undefined}
                        className={cn("inline-flex min-h-[40px] shrink-0 items-center rounded-[6px] border px-3.5 text-sm font-medium transition-colors", on ? "border-ink bg-ink text-canvas" : "border-line text-ink-2 hover:border-line-strong hover:text-ink")}>{t.label}</Link>
                    );
                  })}
                </nav>
                <form role="search" action={BOOKS} className="flex flex-col gap-2 sm:flex-row">
                  {tab && <input type="hidden" name="type" value={tab.id} />}
                  <div className="relative min-w-0 sm:w-64">
                    <label htmlFor="books-q" className="sr-only">Search books</label>
                    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    <input id="books-q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Search books" className="fa-input pl-9" />
                  </div>
                  <label htmlFor="books-sort" className="sr-only">Sort</label>
                  <select id="books-sort" name="sort" defaultValue={sort} className="fa-input sm:w-48">{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                  <button type="submit" className="fa-btn fa-btn-secondary">Apply</button>
                </form>
              </div>
              {grid.length === 0 ? (
                <p className="mt-10 text-body text-ink-2">{q ? `Nothing matches "${q}".` : "Nothing in this format yet."} <Link href={BOOKS} className="text-blue underline underline-offset-4">See all books</Link></p>
              ) : (
                <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {grid.map((p, i) => <li key={p.id} className="fa-rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}><BookCard p={p} currency={currency} index={i} rating={ratings.get(p.id)} /></li>)}
                </ul>
              )}
              {pages > 1 && (
                <nav aria-label="Pages" className="mt-12 flex flex-wrap items-center gap-2">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                    <Link key={n} href={href({ page: n })} aria-current={n === page ? "page" : undefined}
                      className={cn("grid h-10 min-w-10 place-items-center rounded-[6px] border px-3 font-mono text-sm", n === page ? "border-ink bg-ink text-canvas" : "border-line hover:border-line-strong")}>{String(n).padStart(2, "0")}</Link>
                  ))}
                </nav>
              )}
            </FaContainer>
          </section>}
        </>
      )}
      {newsletter}
    </>
  );
}
