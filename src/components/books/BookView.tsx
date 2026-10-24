import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Accordion } from "@/components/ui/Accordion";
import { FaContainer, FaSection } from "@/components/brand/Shell";
import { Pathway } from "@/components/brand/Brand";
import { CurrencySelector } from "@/components/academy/CurrencySelector";
import { BuyButtons } from "@/components/shop/CartClient";
import { NewsletterSignup } from "@/components/academy/NewsletterSignup";
import { ReportReview, ReviewForm, Stars } from "@/components/shop/Reviews";
import { BOOKS, BookCard, BookCover, PriceTag, RichDescription, priceIn } from "./BookParts";
import { getProduct, getShopSettings, TYPE_LABELS, FILE_TYPES } from "@/lib/products";
import { getProductReviews, getRatings } from "@/lib/reviews";
import { getShopperCurrency, pickCurrency } from "@/lib/currency";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

/** One page per book at /academy/books/<slug> (canonical). Old /shop and /academy/shop URLs redirect here. */
export const bookUrl = (slug: string) => `${BOOKS}/${slug}`;

export async function bookMetadata(slug: string): Promise<Metadata> {
  const [p, shop] = await Promise.all([getProduct(slug), getShopSettings()]);
  if (!p) return { title: "Not found", robots: { index: false } };
  if (!shop.enabled) return { title: { absolute: "Books — Fola Academy" }, robots: { index: false, follow: true } };
  const title = `${p.seoTitle ?? p.name} — Fola Academy`;
  const description = p.seoDescription ?? p.shortDescription ?? undefined;
  const image = p.ogImage ?? p.coverImage ?? undefined;
  const url = bookUrl(p.slug);
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

const PER_PAGE = 10;
const FACTS = [["format", "Format"], ["length", "Length"], ["level", "Level"], ["includes_note", "Also includes"]] as const;

export async function BookView({ slug, reviewPage = 1 }: { slug: string; reviewPage?: number }) {
  const p = await getProduct(slug);
  if (!p) notFound();
  if (p.type === "course" && p.courseSlug) permanentRedirect(`/academy/courses/${p.courseSlug}`);
  const shop = await getShopSettings();
  if (!shop.enabled) {
    return <FaContainer className="py-24"><div className="fa-callout max-w-2xl"><p className="fa-label">Books</p><p className="mt-2 text-h3">{shop.closedTitle}</p><p className="mt-2 text-body text-ink-2">{shop.closedBody}</p><Link href="/library" className="fa-btn fa-btn-secondary mt-6">Go to my library</Link></div></FaContainer>;
  }

  const [user, shopper, ratings, reviews] = await Promise.all([getUser(), getShopperCurrency(), getRatings([p.id]), getProductReviews(p.id, reviewPage, PER_PAGE + 1)]);
  let owned = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("can_access_product", { p_product: p.id });
    owned = data === true;
  }
  const currency = shopper.chosen ? shopper.currency : pickCurrency(p.prices.map((x) => x.currency), shopper.currency, shopper.country) ?? shopper.currency;
  const shown = priceIn(p, currency);
  const isFile = FILE_TYPES.includes(p.type);
  const rating = ratings.get(p.id);
  const list = reviews.slice(0, PER_PAGE);
  const more = reviews.length > PER_PAGE;
  const url = `${site.url}${bookUrl(p.slug)}`;
  const facts = FACTS.filter(([k]) => p.details[k]);
  const jsonLd = {
    "@context": "https://schema.org", "@type": p.type === "ebook" ? ["Product", "Book"] : "Product", name: p.name, description: p.shortDescription ?? undefined,
    ...(p.coverImage ? { image: p.coverImage } : {}), brand: { "@type": "Brand", name: "Fola Academy" }, author: { "@type": "Person", name: "Samson Afolabi Odejinmi" }, url,
    offers: p.prices.map((pr) => ({ "@type": "Offer", price: (pr.amountMinor / 100).toFixed(2), priceCurrency: pr.currency, availability: p.comingSoon ? "https://schema.org/PreOrder" : "https://schema.org/InStock", url })),
    ...(p.edition ? { bookEdition: p.edition } : {}),
    ...(rating && rating.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 } } : {}),
  };
  // Coming soon: the details and price are public; buying opens on publish (the database refuses before that).
  const buy = p.comingSoon
    ? <div><span aria-disabled="true" className="fa-btn fa-btn-secondary w-full cursor-not-allowed opacity-80">Coming soon{p.launchNote ? ` · ${p.launchNote}` : ""}</span><p className="mt-3 text-body-sm text-ink-2">Not on sale yet. <a href="#notify" className="font-semibold text-ink underline underline-offset-4">Get notified when it&apos;s out</a>.</p></div>
    : <BuyButtons itemKey={`p:${p.id}`} owned={owned} ownedHref="/library" ownedLabel="Open your library" available={!!shown} />;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="border-b border-line">
        <FaContainer className="grid gap-12 pb-16 pt-8 sm:pt-12 lg:grid-cols-12 lg:gap-16 lg:pb-24 lg:pt-16">
          <nav aria-label="Breadcrumb" className="lg:col-span-12">
            <ol className="flex flex-wrap items-center gap-2 fa-label">
              <li><Link href={BOOKS} className="hover:text-ink">Books</Link></li><li aria-hidden>/</li><li className="text-ink-2">{TYPE_LABELS[p.type]}</li>
            </ol>
          </nav>
          <div className="lg:col-span-5">
            <div className="fa-dots fa-frame mx-auto w-full max-w-md rounded-[8px] border border-line px-[13%] py-[9%] lg:sticky lg:top-28">
              <BookCover name={p.name} image={p.coverImage} type={p.type} priority sizes="(min-width: 1024px) 24rem, 80vw" />
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              {p.comingSoon && <span className="fa-tag !border-node !text-node" data-dot>Coming soon{p.launchNote ? ` · ${p.launchNote}` : ""}</span>}
              <span className="fa-tag" data-dot>{TYPE_LABELS[p.type]}</span>
              {p.edition && <span className="fa-tag">{p.edition}</span>}
              {p.details.level && <span className="fa-tag">{p.details.level}</span>}
              {p.badge && <span className="fa-tag" data-tone="accent">{p.badge}</span>}
            </div>
            <h1 className="mt-5 text-h1">{p.name}</h1>
            {p.shortDescription && <p className="fa-quote mt-5 max-w-prose text-[1.5rem] leading-snug text-ink-2">{p.shortDescription}</p>}
            {rating && rating.count > 0 && (
              <a href="#reviews" className="mt-5 inline-flex min-h-[32px] items-center gap-2 text-body-sm text-ink-2 hover:text-ink"><Stars value={rating.average} /><span className="tabular-nums">{rating.average.toFixed(1)}</span>· {rating.count} review{rating.count === 1 ? "" : "s"}</a>
            )}

            <div className="fa-card mt-8 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {shown ? <div>{p.comingSoon && <p className="fa-label mb-1">Price at launch</p>}<p className="text-h3"><PriceTag p={p} currency={currency} /></p></div> : <p className="text-h4 text-ink-2">{p.comingSoon && !p.prices.length ? "Price announced at launch" : `Not available in ${currency}`}</p>}
                {p.prices.length > 0 && <CurrencySelector current={currency} size="sm" />}
              </div>
              {!shown && p.prices.length > 0 && <p className="mt-2 text-body-sm text-ink-2">Available in {p.prices.map((x) => x.currency).join(", ")}. Switch currency above.</p>}
              <p className="mt-2 text-caption text-ink-3">{p.comingSoon ? `${p.edition ? `${p.edition} · ` : ""}Coming soon: you'll be able to buy it here the moment it's published.` : isFile ? "Instant download after payment · Kept in your Library if you have an account" : p.type === "bundle" ? "Everything below, in one purchase" : "One-time payment"}</p>
              <div className="mt-6">{buy}</div>
            </div>

            {facts.length > 0 && (
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
                {facts.map(([k, label]) => <div key={k}><dt className="fa-label">{label}</dt><dd className="mt-1.5 text-body-sm text-ink">{p.details[k]}</dd></div>)}
              </dl>
            )}
          </div>
        </FaContainer>
      </section>

      {p.comingSoon && (
        <section id="notify" className="scroll-mt-28 border-b border-line">
          <FaContainer className="grid gap-8 py-14 sm:py-16 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6"><p className="fa-label">Coming soon</p><h2 className="mt-3 text-h2">Be first to read it.</h2><p className="mt-3 max-w-prose text-body text-ink-2">One email the day {p.name} is out{p.launchNote ? ` (${p.launchNote.replace(/^out\s*/i, "").trim() || p.launchNote})` : ""}, then occasional news about new books and courses.</p></div>
            <div className="lg:col-span-5 lg:col-start-8"><NewsletterSignup title={`Tell me when ${p.name} is out`} body="No spam; unsubscribe with one click." /></div>
          </FaContainer>
        </section>
      )}

      {p.description && (
        <FaSection label="About this book" title="What it teaches, and why.">
          <div className="grid gap-10 lg:grid-cols-12">
            <RichDescription text={p.description} className="max-w-[68ch] lg:col-span-8" />
            <aside className="lg:col-span-3 lg:col-start-10"><Pathway className="max-w-[12rem]" /><p className="mt-4 text-caption text-ink-3">Idea → understanding → creation. Every Fola book follows the same path.</p></aside>
          </div>
        </FaSection>
      )}

      {p.features.length > 0 && (
        <FaSection label="Contents" title="What's inside">
          <ol className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-2">
            {p.features.map((f, i) => (
              <li key={f} className="flex gap-5 bg-canvas p-5 sm:p-6">
                <span className="font-mono text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span><span className="text-body text-ink">{f}</span>
              </li>
            ))}
          </ol>
        </FaSection>
      )}

      {p.items.length > 0 && (
        <FaSection label="Bundle" title="In this bundle">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-4">{p.items.map((it, i) => <li key={it.id}><BookCard p={it} currency={currency} index={i} /></li>)}</ul>
        </FaSection>
      )}

      <FaSection id="reviews" label="Reviews" title="What readers say">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            {rating && rating.count > 0 ? (
              <div>
                <p className="text-display tabular-nums leading-none">{rating.average.toFixed(1)}<span className="text-h4 text-ink-3">/5</span></p>
                <div className="mt-3"><Stars value={rating.average} size="md" /></div>
                <p className="mt-2 text-body-sm text-ink-2">Based on {rating.count} verified review{rating.count === 1 ? "" : "s"}</p>
              </div>
            ) : <p className="text-body text-ink-2">No reviews yet. Be the first to share your experience.</p>}
            {owned
              ? <div className="mt-8"><h3 className="mb-4 text-h4">Review this {TYPE_LABELS[p.type].toLowerCase()}</h3><ReviewForm productId={p.id} /></div>
              : <p className="mt-6 text-caption text-ink-3">Only readers who bought this can review it. Bought it as a guest? Use the link in your receipt email.</p>}
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {list.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {list.map((r) => (
                  <li key={r.id} className="py-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Stars value={r.rating} label={`${r.rating} out of 5 stars`} />{r.title && <p className="font-semibold">{r.title}</p>}</div>
                    {r.body && <p className="fa-book mt-2 whitespace-pre-line break-words text-ink-2">{r.body}</p>}
                    <p className="mt-3 flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
                      <span>{r.displayName}</span>{r.verified && <span className="text-success">· ✓ Verified purchase</span>}
                      <span>· {new Date(r.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
                      {user && <span>· <ReportReview reviewId={r.id} /></span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {(reviewPage > 1 || more) && (
              <nav aria-label="More reviews" className="mt-6 flex gap-6 text-sm font-medium">
                {reviewPage > 1 && <Link href={`?reviews=${reviewPage - 1}#reviews`} className="text-blue hover:underline">Newer reviews</Link>}
                {more && <Link href={`?reviews=${reviewPage + 1}#reviews`} className="text-blue hover:underline">Older reviews</Link>}
              </nav>
            )}
          </div>
        </div>
      </FaSection>

      {p.related.length > 0 && (
        <FaSection label="Keep going" title="Related">
          <ul className="grid grid-cols-1 gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-4">{p.related.map((r, i) => <li key={r.id}><BookCard p={r} currency={currency} index={i + 1} /></li>)}</ul>
        </FaSection>
      )}

      {p.faq.length > 0 && (
        <FaSection label="FAQ" title="Questions">
          <div className="max-w-3xl"><Accordion items={p.faq} /></div>
        </FaSection>
      )}

      {/* Mobile: the price and the one primary action stay within reach. */}
      {shown && !owned && !p.comingSoon && (
        <div className="sticky bottom-0 z-30 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-[1248px] items-center justify-between gap-4">
            <div className="min-w-0"><p className="truncate text-body-sm font-semibold">{p.name}</p><p className="text-caption text-ink-2"><PriceTag p={p} currency={currency} /></p></div>
            <Link href={`/checkout?buy=p:${p.id}`} className="fa-btn fa-btn-primary shrink-0">Buy now</Link>
          </div>
        </div>
      )}
    </>
  );
}
