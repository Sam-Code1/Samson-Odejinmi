import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { canOptimize } from "@/lib/cms/images";
import { TYPE_LABELS, type ProductCard as Card } from "@/lib/products";
import { formatMoney } from "@/lib/utils";

/** Shop card. Course products link to the course page (one page per course), everything else to its product page. */
export function productHref(p: Pick<Card, "type" | "slug" | "courseSlug">) {
  return p.type === "course" && p.courseSlug ? `/academy/courses/${p.courseSlug}` : `/academy/shop/${p.slug}`;
}

/**
 * `currency`: the shopper's selected currency. The card shows that price; if this item isn't priced in it, the card
 * says so and shows what it IS priced in (never silently a different currency as if it were the selected one).
 */
export function ProductCard({ product: p, index = 0, currency }: { product: Card; index?: number; currency?: string }) {
  const exact = currency ? p.prices.find((x) => x.currency === currency) : p.prices[0];
  const price = exact ?? p.prices[0];
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-elevated transition-colors hover:border-line-strong">
      <div className="theme-night spot-stage relative aspect-[4/3] overflow-hidden">
        {p.coverImage ? (
          <Image src={p.coverImage} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" unoptimized={!canOptimize(p.coverImage)}
            className="object-contain p-6 transition-transform duration-slow ease-quiet group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : <PlaceholderArt variant={index} />}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><Badge>{TYPE_LABELS[p.type]}</Badge>{p.badge && <Badge tone="accent">{p.badge}</Badge>}</div>
        <h3 className="mt-3 text-h4">
          <Link href={productHref(p)} className="after:absolute after:inset-0"><span className="link-line pb-0.5">{p.name}</span></Link>
        </h3>
        {p.shortDescription && <p className="mt-2 line-clamp-3 text-body-sm text-ink-2">{p.shortDescription}</p>}
        <div className="mt-auto flex items-center justify-between gap-4 pt-5">
          <p className="text-label tabular-nums">
            {!price ? "Coming soon" : price.amountMinor === 0 ? "Free" : formatMoney(price.amountMinor, price.currency)}
            {price && exact && exact.compareAtMinor ? <span className="ml-2 text-caption text-ink-3 line-through"><span className="sr-only">was </span>{formatMoney(exact.compareAtMinor, exact.currency)}</span> : null}
            {price && !exact && currency ? <span className="mt-0.5 block text-caption font-normal text-ink-3">Not priced in {currency}</span> : null}
          </p>
          <ArrowUpRight aria-hidden className="h-4 w-4 text-ink-3 transition-transform duration-base ease-quiet group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
        </div>
      </div>
    </article>
  );
}
