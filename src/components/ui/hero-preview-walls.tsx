"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HeroVisual } from "@/components/visual/HeroVisual";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { Emph, Lines } from "@/components/cms/RichText";
import type { Section } from "@/lib/cms/types";

/**
 * Card stack + hero (adapted from 21st.dev hero-preview-walls).
 * Changes for this project: motion/react instead of framer-motion, project tokens instead of neutral-*,
 * no module-level interval, autoplay only while visible, hover/focus pauses it, reduced-motion turns it off,
 * optional manual controls, screen-reader-friendly (only the front card is exposed), and brand content.
 */
export type StackCard = {
  id: number | string;
  name: string;
  designation: string;
  content: React.ReactNode;
  visual?: React.ReactNode;
  tint?: "blue" | "violet" | "peach" | "mint";
};

const tintBg = { blue: "bg-tint-blue", violet: "bg-tint-violet", peach: "bg-tint-peach", mint: "bg-tint-mint" } as const;

export function CardSlide({
  items,
  offset = 22,
  scaleFactor = 0.06,
  intervalDuration = 3500,
  controls = false,
  label = "Cards",
  className,
}: {
  items: StackCard[];
  offset?: number;
  scaleFactor?: number;
  intervalDuration?: number;
  controls?: boolean;
  label?: string;
  className?: string;
}) {
  const [cards, setCards] = React.useState<StackCard[]>(items);
  const [dynamicOffset, setDynamicOffset] = React.useState(offset);
  const [dynamicScale, setDynamicScale] = React.useState(scaleFactor);
  const [size, setSize] = React.useState({ height: "25rem", width: "min(24rem, calc(100vw - 3rem))" });
  const [paused, setPaused] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px" });
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w < 640) { setDynamicOffset(10); setDynamicScale(0.04); setSize({ height: "25rem", width: "min(24rem, calc(100vw - 3rem))" }); }
      else if (w < 1024) { setDynamicOffset(14); setDynamicScale(0.05); setSize({ height: "27rem", width: "26rem" }); }
      else { setDynamicOffset(offset); setDynamicScale(scaleFactor); setSize({ height: "28rem", width: "28rem" }); }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [offset, scaleFactor]);

  const rotate = React.useCallback(() => setCards((prev) => { const a = [...prev]; a.unshift(a.pop()!); return a; }), []);

  React.useEffect(() => {
    if (reduce || paused || !inView || items.length < 2) return;
    const id = window.setInterval(rotate, intervalDuration);
    return () => window.clearInterval(id);
  }, [reduce, paused, inView, intervalDuration, rotate, items.length]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        ref={ref}
        role="group"
        aria-roledescription="carousel"
        aria-label={label}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="relative flex justify-center"
        style={{ height: `calc(${size.height} + ${cards.length * dynamicOffset}px)`, width: size.width }}
      >
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            aria-hidden={index !== 0}
            className="absolute flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-elevated p-5 text-left text-ink shadow-[0_30px_60px_-28px_rgb(var(--ink)/0.4)] sm:p-6 md:p-7"
            style={{ transformOrigin: "top center", height: size.height, width: size.width }}
            animate={{ top: index * -dynamicOffset, scale: 1 - index * dynamicScale, zIndex: cards.length - index }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18 }}
          >
            <div className="space-y-3">
              <div className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">{card.name}</div>
              <div className="text-sm leading-relaxed text-ink-2 sm:text-base">{card.content}</div>
              {card.visual && (
                <div className={cn("relative mt-3 h-32 overflow-hidden rounded-lg border border-line sm:h-40", card.tint && tintBg[card.tint])}>{card.visual}</div>
              )}
            </div>
            <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
              <span aria-hidden className="thread-solid h-px w-6" />
              <p className="text-sm font-medium text-ink-2">{card.designation}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {controls && (
        <div className="mt-8 flex items-center gap-5">
          <button type="button" onClick={rotate} className="h-11 rounded border border-line-strong px-5 text-label transition-colors hover:border-ink">Next</button>
          <span className="text-caption text-ink-3" aria-live="polite">{reduce ? "Autoplay is off" : paused ? "Paused" : "Hover to pause"}</span>
        </div>
      )}

      {/* Everything, in order, for screen readers. */}
      <ol className="sr-only">{items.map((c) => <li key={c.id}>{c.name}: {c.designation}</li>)}</ol>
    </div>
  );
}

/** Home hero: headline left-aligned, framed 3D scene below, capability cards stacked over its lower edge. Content comes from the CMS. */
export function HeroPreviewWalls({ hero }: { hero: Section }) {
  const reduce = useReducedMotion();
  const tints = ["blue", "violet", "peach", "mint"] as const;
  const cards: StackCard[] = hero.items.map((it, i) => ({
    id: i,
    name: it.title ?? "",
    designation: it.meta ?? "",
    tint: tints[i % tints.length],
    visual: <PlaceholderArt variant={i} />,
    content: it.body ? <p><Emph text={it.body} accent={i} /></p> : null,
  }));
  const rise = (d: number) => ({ initial: reduce ? false : { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay: d, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <section className="mesh grain relative w-full overflow-hidden border-b border-line pb-28 pt-14 sm:pb-24 sm:pt-20 lg:pt-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {hero.eyebrow && <motion.div {...rise(0)}><Badge className="mb-6 rounded-full border-line-strong bg-elevated/70 px-3 py-1.5 text-xs backdrop-blur">{hero.eyebrow}</Badge></motion.div>}
        {hero.title && <motion.h1 {...rise(0.08)} className="text-display"><Lines text={hero.title} /></motion.h1>}
        {hero.body && <motion.p {...rise(0.18)} className="mt-8 max-w-[34rem] text-body-lg text-ink-2">{hero.body}</motion.p>}
        {(hero.cta || hero.cta2) && (
          <motion.div {...rise(0.26)} className="mb-14 mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mb-20">
            {hero.cta?.label && <Button href={hero.cta.href} size="lg">{hero.cta.label}</Button>}
            {hero.cta2 && <Button href={hero.cta2.href} variant="text">{hero.cta2.label}</Button>}
          </motion.div>
        )}
      </div>

      <div className={cn("relative mx-auto flex max-w-6xl justify-center px-5 sm:px-8", !(hero.cta || hero.cta2) && "mt-14")}>
        <div className="relative h-[34rem] w-full overflow-hidden rounded-2xl border-8 border-elevated bg-canvas shadow-[0_40px_80px_-40px_rgb(var(--ink)/0.5)] ring-1 ring-line sm:h-[38rem] lg:h-[40rem]">
          <HeroVisual className="absolute inset-0 h-full w-full" />
        </div>
        {cards.length > 0 && (
          <div className="absolute -bottom-24 flex w-full justify-center sm:-bottom-12">
            <CardSlide items={cards} label="What I work on" />
          </div>
        )}
      </div>
    </section>
  );
}
