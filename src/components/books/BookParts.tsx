import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { FMark } from "@/components/brand/Brand";
import { canOptimize } from "@/lib/cms/images";
import { TYPE_LABELS, type ProductCard as Card } from "@/lib/product-types";
import { cn, formatMoney } from "@/lib/utils";

/** The Books storefront lives at /academy/books (canonical). Courses keep their own pages. */
export const BOOKS = "/academy/books";
export const bookHref = (p: Pick<Card, "type" | "slug" | "courseSlug">) =>
  p.type === "course" && p.courseSlug ? `/academy/courses/${p.courseSlug}` : `${BOOKS}/${p.slug}`;

/**
 * A book cover: the uploaded cover image, or (when there is none) a generated cover in the Fola Academy book style
 * (§15: Night, label top-left, one hero object, title bottom-left in Schibsted 800, author + symbol at the foot).
 * 2:3 like the 6 × 9 in trim; shadow for depth.
 */
export function BookCover({ name, image, type, index = 0, className, priority = false, sizes = "(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 80vw" }: {
  name: string; image: string | null; type: Card["type"]; index?: number; className?: string; priority?: boolean; sizes?: string;
}) {
  return (
    <div className={cn("fa-cover relative aspect-[2/3] w-full overflow-hidden rounded-[2px] bg-[#080B16]", className)}>
      {image ? (
        <Image src={image} alt={`${name} cover`} fill priority={priority} sizes={sizes} unoptimized={!canOptimize(image)} className="object-cover" />
      ) : (
        <div className="theme-night absolute inset-0 flex flex-col justify-between bg-canvas p-[8%]" aria-label={`${name} cover`} role="img">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle, rgb(134 140 163 / 0.35) 1px, transparent 1.5px)", backgroundSize: "14px 14px" }} aria-hidden />
          <p className="fa-label relative !text-[0.55rem]">Fola Academy · {TYPE_LABELS[type]} {String(index + 1).padStart(2, "0")}</p>
          <div aria-hidden className="relative mx-auto w-[42%] opacity-95"><FMark className="h-auto w-full" /></div>
          <div className="relative">
            <p className="break-words font-extrabold leading-[0.95] tracking-[-0.035em] text-ink" style={{ fontSize: "clamp(1rem, 2.2vw, 1.6rem)" }}>{name}</p>
            <div className="mt-3 flex items-center gap-2"><FMark small className="h-3 w-3" /><span className="fa-label !text-[0.5rem]">Samson Afolabi Odejinmi</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function priceIn(p: Pick<Card, "prices">, currency: string) {
  return p.prices.find((x) => x.currency === currency) ?? null;
}

/** Price in the shopper's currency, or what it IS priced in (never silently another currency). */
export function PriceTag({ p, currency, className }: { p: Pick<Card, "prices">; currency: string; className?: string }) {
  const exact = priceIn(p, currency);
  const any = exact ?? p.prices[0];
  if (!any) return <span className={cn("text-body-sm text-ink-3", className)}>Coming soon</span>;
  return (
    <span className={cn("tabular-nums", className)}>
      {any.amountMinor === 0 ? "Free" : formatMoney(any.amountMinor, any.currency)}
      {exact?.compareAtMinor && exact.compareAtMinor > exact.amountMinor ? <span className="ml-2 text-[0.8em] text-ink-3 line-through"><span className="sr-only">was </span>{formatMoney(exact.compareAtMinor, exact.currency)}</span> : null}
      {!exact && <span className="ml-2 text-caption text-ink-3">({any.currency})</span>}
    </span>
  );
}

/** Book card (§16 Shop: editorial grid, product art in frames on surface, format tags). */
export function BookCard({ p, currency, index = 0, rating }: { p: Card; currency: string; index?: number; rating?: { average: number; count: number } }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="fa-dots fa-card-hover relative flex aspect-[4/5] items-center justify-center rounded-[8px] border border-line px-[16%] py-[10%]">
        <BookCover name={p.name} image={p.coverImage} type={p.type} index={index} className="transition-transform duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] group-hover:-translate-y-1" />
        {p.badge && <span className="fa-tag absolute left-3 top-3 bg-surface" data-tone="accent">{p.badge}</span>}
      </div>
      <div className="flex flex-1 flex-col pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="fa-tag" data-dot>{TYPE_LABELS[p.type]}</span>
          {rating && rating.count > 0 && <span className="inline-flex items-center gap-1 text-caption text-ink-2"><Star aria-hidden className="h-3 w-3 fill-current text-node" />{rating.average.toFixed(1)}<span className="text-ink-3">({rating.count})</span></span>}
        </div>
        <h3 className="mt-3 text-h4">
          <Link href={bookHref(p)} className="after:absolute after:inset-0 focus-visible:outline-none">{p.name}</Link>
        </h3>
        {p.shortDescription && <p className="mt-2 line-clamp-2 text-body-sm text-ink-2">{p.shortDescription}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <PriceTag p={p} currency={currency} className="text-label" />
          <span aria-hidden className="inline-flex items-center gap-1 text-caption text-ink-3 transition-colors group-hover:text-blue">View<ArrowRight className="h-3.5 w-3.5 transition-transform duration-[160ms] group-hover:translate-x-[3px]" /></span>
        </div>
      </div>
    </article>
  );
}

/**
 * Long description ("About this book"): plain text an admin writes, with light structure:
 *   blank line = new paragraph · "## " = heading · "- " lines = list · "> " = pull quote · *word* = emphasis.
 * Rendered in the reading serif (Newsreader, §08) at reading width. No HTML is ever interpreted.
 */
export function RichDescription({ text, className }: { text: string | null | undefined; className?: string }) {
  // Line-based: authors often write one item per line without blank lines, so every line counts.
  // Consecutive "- " / "• " lines → one list; "## " → heading; "> " lines → pull quote; any other line → paragraph.
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const em = (t: string) => t.split(/\*([^*]+)\*/g).map((s, i) => (i % 2 ? <em key={i} className="text-violet-soft not-italic">{s}</em> : s));
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (/^[-•]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i])) items.push(lines[i++].replace(/^[-•]\s/, ""));
      i--;
      out.push(<ul key={i} className="space-y-2">{items.map((it, k) => <li key={k} className="flex gap-3"><span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-node" />{em(it)}</li>)}</ul>);
    } else if (l.startsWith("## ")) {
      out.push(<h3 key={i} className="pt-4 font-sans text-h4 text-ink">{l.slice(3)}</h3>);
    } else if (l.startsWith("> ")) {
      out.push(<blockquote key={i} className="fa-quote border-l border-line-strong pl-5 text-[1.375rem] leading-snug text-ink">{em(l.slice(2))}</blockquote>);
    } else {
      out.push(<p key={i}>{em(l)}</p>);
    }
  }
  if (!out.length) return null;
  return <div className={cn("fa-book space-y-4 text-ink-2", className)}>{out}</div>;
}
