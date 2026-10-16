import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Container, Section } from "@/components/ui/Container";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Accordion } from "@/components/ui/Accordion";
import { Paragraphs } from "@/components/cms/RichText";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { ProductCard } from "@/components/academy/ProductCard";
import { ProductCheckoutPanel } from "@/components/academy/ProductCheckoutPanel";
import { getProduct, getShopSettings, TYPE_LABELS, FILE_TYPES } from "@/lib/products";
import { StateMessage } from "@/components/ui/States";
import { canOptimize } from "@/lib/cms/images";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPaymentOptions, publicMethods } from "@/lib/payments/options";
import { formatMoney } from "@/lib/utils";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [p, shop] = await Promise.all([getProduct(slug), getShopSettings()]);
  if (!p) return { title: "Not found", robots: { index: false } };
  if (!shop.enabled) return { title: { absolute: `${shop.title} — Fola Academy` }, robots: { index: false, follow: true } };
  const title = `${p.seoTitle ?? p.name} — Fola Academy`;
  const description = p.seoDescription ?? p.shortDescription ?? undefined;
  const image = p.ogImage ?? p.coverImage ?? undefined;
  const url = `/academy/shop/${p.slug}`;
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  // A course has one public page: its course page.
  if (p.type === "course" && p.courseSlug) permanentRedirect(`/academy/courses/${p.courseSlug}`);
  const shop = await getShopSettings();
  if (!shop.enabled) {
    return (
      <Container className="pb-20 pt-14 sm:pt-20 lg:pt-28">
        <StateMessage title={shop.closedTitle} body={shop.closedBody} action={{ href: "/library", label: "Go to my library" }} secondary={{ href: "/academy/courses", label: "See courses" }} />
      </Container>
    );
  }

  const user = await getUser();
  let owned = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("can_access_product", { p_product: p.id });
    owned = data === true;
  }
  const payOpts = await getPaymentOptions();
  const isFile = FILE_TYPES.includes(p.type);
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription ?? undefined, ...(p.coverImage ? { image: p.coverImage } : {}),
    brand: { "@type": "Brand", name: "Fola Academy" }, url: `${site.url}/academy/shop/${p.slug}`,
    offers: p.prices.map((pr) => ({ "@type": "Offer", price: (pr.amountMinor / 100).toFixed(2), priceCurrency: pr.currency, availability: "https://schema.org/InStock", url: `${site.url}/academy/shop/${p.slug}` })),
  };
  const panel = (
    <ProductCheckoutPanel productId={p.id} slug={p.slug} prices={p.prices} methods={publicMethods(payOpts)} signedIn={!!user} owned={owned} ownedHref="/library" />
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Container className="grid grid-cols-1 gap-12 pb-14 pt-10 sm:pt-16 lg:grid-cols-12 lg:pb-20 lg:pt-20">
          <div className="lg:col-span-7">
            <Link href="/academy/shop" className="inline-flex min-h-[44px] items-center text-label text-ink-3 hover:text-ink"><span className="link-line pb-0.5">Shop</span></Link>
            <div className="mt-4 flex flex-wrap gap-2"><Badge>{TYPE_LABELS[p.type]}</Badge>{p.badge && <Badge tone="accent">{p.badge}</Badge>}</div>
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
              {p.prices[0] && <p className="text-h2 tabular-nums">{p.prices[0].amountMinor === 0 ? "Free" : formatMoney(p.prices[0].amountMinor, p.prices[0].currency)}</p>}
              <p className="mt-1 text-caption text-ink-3">{isFile ? "Instant download after payment · Kept in your library" : p.type === "bundle" ? "Everything below, in one purchase" : "One-time payment"}</p>
              <div className="mt-6">{panel}</div>
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
              {p.features.length > 0 && (
                <ul className="space-y-3">{p.features.map((f) => (
                  <li key={f} className="flex gap-3 text-body-lg"><Check aria-hidden className="mt-1.5 h-4 w-4 shrink-0 text-blue" />{f}</li>
                ))}</ul>
              )}
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
            <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{p.items.map((it, i) => <li key={it.id}><ProductCard product={it} index={i} /></li>)}</ul>
          </Container>
        </Section>
      )}

      {p.related.length > 0 && (
        <Section>
          <Container>
            <h2 className="text-h2">Recommended next</h2>
            <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{p.related.map((r, i) => <li key={r.id}><ProductCard product={r} index={i + 1} /></li>)}</ul>
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
          <h2 className="max-w-3xl text-h1">{p.name}</h2>
          <div className="w-full max-w-sm rounded-xl border border-line bg-elevated p-6">{panel}</div>
        </Container>
      </Section>
    </>
  );
}
