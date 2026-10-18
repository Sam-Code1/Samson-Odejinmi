import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Check } from "lucide-react";
import { Container, Section } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { Paragraphs } from "@/components/cms/RichText";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { StateMessage } from "@/components/ui/States";
import { ProductCard } from "@/components/academy/ProductCard";
import { CurrencySelector } from "@/components/academy/CurrencySelector";
import { BuyButtons } from "@/components/shop/CartClient";
import { ReportReview, ReviewForm, Stars } from "@/components/shop/Reviews";
import { getProduct, getShopSettings, TYPE_LABELS, FILE_TYPES } from "@/lib/products";
import { getProductReviews, getRatings } from "@/lib/reviews";
import { getShopperCurrency, pickCurrency } from "@/lib/currency";
import { canOptimize } from "@/lib/cms/images";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { site } from "@/lib/site";

/**
 * ONE product page, rendered on both storefronts (main site /shop/<slug> and Academy /academy/shop/<slug>) from the
 * same product, prices, checkout, orders and reviews. The canonical URL is /shop/<slug> so search engines see one page.
 */
export type ShopBase = "/shop" | "/academy/shop";
export const canonicalProduct = (slug: string) => `/shop/${slug}`;

export async function productMetadata(slug: string): Promise<Metadata> {
  const [p, shop] = await Promise.all([getProduct(slug), getShopSettings()]);
  if (!p) return { title: "Not found", robots: { index: false } };
  if (!shop.enabled) return { title: { absolute: `${shop.title} — Fola Academy` }, robots: { index: false, follow: true } };
  const title = `${p.seoTitle ?? p.name} — Fola Academy`;
  const description = p.seoDescription ?? p.shortDescription ?? undefined;
  const image = p.ogImage ?? p.coverImage ?? undefined;
  const url = canonicalProduct(p.slug);
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

const PER_PAGE = 10;

export async function ProductView({ slug, base, reviewPage = 1 }: { slug: string; base: ShopBase; reviewPage?: number }) {
  const p = await getProduct(slug);
  if (!p) notFound();
  // A course has one public page: its course page.
  if (p.type === "course" && p.courseSlug) permanentRedirect(`/academy/courses/${p.courseSlug}`);
  const shop = await getShopSettings();
  if (!shop.enabled) {
    return <Container className="pb-20 pt-14 sm:pt-20 lg:pt-28"><StateMessage title={shop.closedTitle} body={shop.closedBody} action={{ href: "/library", label: "Go to my library" }} secondary={{ href: "/academy/courses", label: "See courses" }} /></Container>;
  }

  const [user, shopper, ratings, reviews] = await Promise.all([getUser(), getShopperCurrency(), getRatings([p.id]), getProductReviews(p.id, reviewPage, PER_PAGE + 1)]);
  let owned = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("can_access_product", { p_product: p.id });
    owned = data === true;
  }
  const currency = shopper.chosen ? shopper.currency : pickCurrency(p.prices.map((x) => x.currency), shopper.currency, shopper.country) ?? shopper.currency;
  const shown = p.prices.find((x) => x.currency === currency);
  const isFile = FILE_TYPES.includes(p.type);
  const rating = ratings.get(p.id);
  const more = reviews.length > PER_PAGE;
  const list = reviews.slice(0, PER_PAGE);
  const url = `${site.url}${canonicalProduct(p.slug)}`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription ?? undefined, ...(p.coverImage ? { image: p.coverImage } : {}),
    brand: { "@type": "Brand", name: "Fola Academy" }, url,
    offers: p.prices.map((pr) => ({ "@type": "Offer", price: (pr.amountMinor / 100).toFixed(2), priceCurrency: pr.currency, availability: "https://schema.org/InStock", url })),
    // Only real, approved reviews; omitted entirely when there are none.
    ...(rating && rating.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 } } : {}),
  };
  const buy = (
    <BuyButtons itemKey={`p:${p.id}`} owned={owned} ownedHref="/library" ownedLabel="Open your library" available={!!shown} />
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Container className="grid grid-cols-1 gap-12 pb-14 pt-10 sm:pt-16 lg:grid-cols-12 lg:pb-20 lg:pt-20">
          <div className="lg:col-span-7">
            <Link href={base} className="inline-flex min-h-[44px] items-center text-label text-ink-3 hover:text-ink"><span className="link-line pb-0.5">Shop</span></Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge>{TYPE_LABELS[p.type]}</Badge>{p.badge && <Badge tone="accent">{p.badge}</Badge>}
              {rating && rating.count > 0 && <a href="#reviews" className="ml-1 inline-flex min-h-[32px] items-center gap-2 text-caption text-ink-2 hover:text-ink"><Stars value={rating.average} />{rating.average.toFixed(1)} · {rating.count} review{rating.count === 1 ? "" : "s"}</a>}
            </div>
            <h1 className="mt-5 text-display">{p.name}</h1>
            {p.shortDescription && <p className="mt-6 max-w-prose text-body-lg text-ink-2">{p.shortDescription}</p>}
            <div className="theme-night spot-stage relative mt-10 aspect-[4/3] max-w-xl overflow-hidden rounded-xl border border-line">
              {p.coverImage
                ? <Image src={p.coverImage} alt={`${p.name} cover`} fill priority sizes="(min-width: 1024px) 36rem, 100vw" unoptimized={!canOptimize(p.coverImage)} className="object-contain p-8" />
                : <PlaceholderArt variant={1} />}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-line bg-elevated/80 p-6 shadow-[0_30px_60px_-34px_rgb(var(--ink)/0.45)] backdrop-blur lg:sticky lg:top-24">
              <div className="thread -mx-6 -mt-6 mb-6 h-px" aria-hidden />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {shown
                  ? <p className="text-h2 tabular-nums">{shown.amountMinor === 0 ? "Free" : formatMoney(shown.amountMinor, shown.currency)}</p>
                  : <p className="text-h4 text-ink-2">Not available in {currency}</p>}
                {p.prices.length > 0 && <CurrencySelector current={currency} size="sm" />}
              </div>
              {shown?.compareAtMinor && shown.compareAtMinor > shown.amountMinor && (
                <p className="mt-1 text-body-sm text-ink-3"><span className="sr-only">Was </span><span className="line-through tabular-nums">{formatMoney(shown.compareAtMinor, shown.currency)}</span></p>
              )}
              <p className="mt-1 text-caption text-ink-3">{isFile ? "Instant download after payment" : p.type === "bundle" ? "Everything below, in one purchase" : "One-time payment"}</p>
              {!shown && p.prices.length > 0 && <p className="mt-3 text-body-sm text-ink-2">Available in {p.prices.map((x) => x.currency).join(", ")}. Switch currency above.</p>}
              <div className="mt-6">{buy}</div>
            </div>
          </div>
        </Container>
      </section>

      {p.description && (
        <Section>
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">What&apos;s inside</h2>
            <Paragraphs text={p.description} className="space-y-5 text-body-lg text-ink-2 lg:col-span-7 lg:col-start-6" />
          </Container>
        </Section>
      )}

      {(p.features.length > 0 || Object.keys(p.details).length > 0) && (
        <Section tone="mint">
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">What you get</h2>
            <div className="lg:col-span-7 lg:col-start-6">
              {p.features.length > 0 && <ul className="space-y-3">{p.features.map((f) => <li key={f} className="flex gap-3 text-body-lg"><Check aria-hidden className="mt-1.5 h-4 w-4 shrink-0 text-blue" />{f}</li>)}</ul>}
              {Object.keys(p.details).length > 0 && (
                <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-6 text-body-sm sm:grid-cols-4">
                  {([["format", "Format"], ["length", "Length"], ["level", "Level"], ["includes_note", "Also"]] as const).filter(([k]) => p.details[k]).map(([k, label]) => (
                    <div key={k}><dt className="text-caption text-ink-3">{label}</dt><dd className="mt-1">{p.details[k]}</dd></div>
                  ))}
                </dl>
              )}
            </div>
          </Container>
        </Section>
      )}

      {p.items.length > 0 && (
        <Section tone="violet">
          <Container>
            <h2 className="text-h2">In this bundle</h2>
            <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{p.items.map((it, i) => <li key={it.id}><ProductCard product={it} index={i} currency={currency} base={base} /></li>)}</ul>
          </Container>
        </Section>
      )}

      <Section id="reviews">
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-h2">Customer reviews</h2>
            {rating && rating.count > 0 ? (
              <div className="mt-4">
                <p className="text-display tabular-nums leading-none">{rating.average.toFixed(1)}<span className="text-h4 text-ink-3">/5</span></p>
                <div className="mt-3"><Stars value={rating.average} size="md" /></div>
                <p className="mt-2 text-body-sm text-ink-2">Based on {rating.count} verified review{rating.count === 1 ? "" : "s"}</p>
              </div>
            ) : <p className="mt-4 text-body text-ink-2">No reviews yet. Be the first to share your experience.</p>}
            {owned && <div className="mt-8"><h3 className="mb-4 text-h4">Review this {TYPE_LABELS[p.type].toLowerCase()}</h3><ReviewForm productId={p.id} /></div>}
            {!owned && <p className="mt-6 text-caption text-ink-3">Only customers who bought this can review it. Bought it as a guest? Use the link in your receipt email.</p>}
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            {list.length > 0 && (
              <ul className="divide-y divide-line border-y border-line">
                {list.map((r) => (
                  <li key={r.id} className="py-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Stars value={r.rating} label={`${r.rating} out of 5 stars`} />{r.title && <p className="text-label">{r.title}</p>}</div>
                    {r.body && <p className="mt-2 whitespace-pre-line break-words text-body text-ink-2">{r.body}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-caption text-ink-3">
                      <span>{r.displayName}</span>{r.verified && <span className="text-blue">· Verified purchase</span>}
                      <span>· {new Date(r.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
                      {user && <span>· <ReportReview reviewId={r.id} /></span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {(reviewPage > 1 || more) && (
              <nav aria-label="More reviews" className="mt-6 flex gap-4 text-label">
                {reviewPage > 1 && <Link href={`?reviews=${reviewPage - 1}#reviews`} className="underline underline-offset-4">Newer reviews</Link>}
                {more && <Link href={`?reviews=${reviewPage + 1}#reviews`} className="underline underline-offset-4">Older reviews</Link>}
              </nav>
            )}
          </div>
        </Container>
      </Section>

      {p.related.length > 0 && (
        <Section>
          <Container>
            <h2 className="text-h2">Related products</h2>
            <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{p.related.map((r, i) => <li key={r.id}><ProductCard product={r} index={i + 1} currency={currency} base={base} /></li>)}</ul>
          </Container>
        </Section>
      )}

      {p.faq.length > 0 && (
        <Section>
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">Questions</h2>
            <div className="lg:col-span-7 lg:col-start-6"><Accordion items={p.faq} /></div>
          </Container>
        </Section>
      )}

      <Section tone="night">
        <Container className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div>
            <h2 className="max-w-3xl text-h1">{p.name}</h2>
            {shown && <p className="mt-3 text-h3 tabular-nums">{shown.amountMinor === 0 ? "Free" : formatMoney(shown.amountMinor, shown.currency)}</p>}
          </div>
          <div className="w-full max-w-sm rounded-xl border border-line bg-elevated p-6">{buy}</div>
        </Container>
      </Section>
    </>
  );
}
