import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container, Section, SectionHeader } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { bookHref } from "@/components/books/BookParts";
import { getPublishedProducts, getShopSettings, TYPE_LABELS } from "@/lib/products";
import { canOptimize } from "@/lib/cms/images";
import { formatMoney } from "@/lib/utils";

/**
 * Homepage shop preview (main site and Academy): up to three featured (else newest) published products from the one
 * shop. These pages are statically cached, so instead of guessing the visitor's currency the card lists the real
 * prices in every currency the product is sold in. Renders nothing when the shop is closed or has no products.
 */
const COPY = {
  site: { title: "Resources I've created", intro: "Practical guides, digital products and learning resources designed around 3D, design and creative technology.", cta: "Explore Books", base: "/academy/books" as const },
  academy: { title: "Go beyond the lessons", intro: "Explore practical resources created to help you understand creative technology and build with confidence.", cta: "Explore Books", base: "/academy/books" as const },
};

export async function ShopPreview({ surface, tone = "peach", id }: { surface: "site" | "academy"; tone?: "peach" | "mint" | "violet"; id?: string }) {
  const [products, shop] = await Promise.all([getPublishedProducts(), getShopSettings()]);
  if (!shop.enabled || products.length === 0) return null;
  const picks = [...products.filter((p) => p.featured), ...products.filter((p) => !p.featured)].slice(0, 3);
  const copy = COPY[surface];
  return (
    <Section tone={tone} id={id}>
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader title={copy.title} intro={copy.intro} />
          <Button href={copy.base} variant="text">{copy.cta} →</Button>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((p, i) => (
            <li key={p.id}>
              <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-elevated transition-colors hover:border-line-strong">
                <div className="theme-night spot-stage relative aspect-[4/3] overflow-hidden">
                  {p.coverImage
                    ? <Image src={p.coverImage} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" unoptimized={!canOptimize(p.coverImage)} className="object-contain p-6 transition-transform duration-slow ease-quiet group-hover:scale-[1.03] motion-reduce:transition-none" />
                    : <PlaceholderArt variant={i} />}
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <Badge className="self-start">{TYPE_LABELS[p.type]}</Badge>
                  <h3 className="mt-3 text-h4"><Link href={bookHref(p)} className="after:absolute after:inset-0"><span className="link-line pb-0.5">{p.name}</span></Link></h3>
                  {p.shortDescription && <p className="mt-2 line-clamp-2 text-body-sm text-ink-2">{p.shortDescription}</p>}
                  <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                    <p className="text-label tabular-nums">{p.prices.length ? p.prices.map((x) => (x.amountMinor === 0 ? "Free" : formatMoney(x.amountMinor, x.currency))).filter((v, k, a) => a.indexOf(v) === k).join(" · ") : "Coming soon"}</p>
                    <span className="inline-flex items-center gap-1 text-caption text-ink-2">View<ArrowUpRight aria-hidden className="h-4 w-4 transition-transform duration-base ease-quiet group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
