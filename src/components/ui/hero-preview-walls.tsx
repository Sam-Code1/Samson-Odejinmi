"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HeroVisual } from "@/components/visual/HeroVisual";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { Emph, Lines } from "@/components/cms/RichText";
import type { Section } from "@/lib/cms/types";
import { Card } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight";
import { LazySpline } from "@/components/sections/LazySpline";

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

/**
 * Home hero, built on the Spline "interactive 3D" card: hero text on the left, a live 3D scene on the right,
 * a cursor spotlight, and the blue→violet thread on the top edge. The card is a `.theme-night` band, so it stays dark
 * in both themes using the project tokens. Capability cards stack just below it. All text comes from the CMS.
 */
export type HeroPortrait = { src: string; alt: string; optimize: boolean; word: string | null };

/** You, cut out, standing in front of one giant chrome word. Replaces the 3D scene when a portrait is set. */
function PortraitStage({ p, reduce }: { p: HeroPortrait; reduce: boolean | null }) {
  return (
    <div className="absolute inset-0 overflow-hidden [container-type:size]">
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[30%] h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--ink)/0.16),transparent)]" />
      {p.word && (
        <motion.span
          aria-hidden
          initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-chrome pointer-events-none absolute inset-x-0 top-[16%] select-none whitespace-nowrap text-center font-extrabold uppercase leading-none tracking-[-0.05em]"
          style={{ fontSize: `min(${Math.round(150 / Math.max(p.word.length, 3))}cqw, 46cqh)` }}
        >
          {p.word}
        </motion.span>
      )}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 top-[8%]"
      >
        <Image src={p.src} alt={p.alt} fill priority sizes="(min-width: 768px) 46vw, 100vw" unoptimized={!p.optimize} className="object-contain object-bottom drop-shadow-[0_30px_40px_rgb(0_0_0/0.45)]" />
      </motion.div>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}

export function HeroPreviewWalls({ hero, scene, portrait, poster }: { hero: Section; scene: string | null; portrait?: HeroPortrait | null; poster?: string | null }) {
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
    <section className={cn("mesh grain relative w-full overflow-hidden border-b border-line pt-6 sm:pt-8 lg:pt-10", cards.length ? "pb-16 sm:pb-20" : "pb-12 sm:pb-16")}>
      <div className="mx-auto max-w-page px-5 sm:px-8 lg:px-12">
        <motion.div {...rise(0)}>
          <Card className="theme-night relative w-full overflow-hidden border-line bg-canvas shadow-[0_40px_80px_-40px_rgb(var(--ink)/0.55)] md:min-h-[min(82vh,660px)]">
            <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" size={260} />
            <span aria-hidden className="thread absolute inset-x-0 top-0 h-px" />
            {/* Two columns at every size: text ~55%, robot ~45% on phones (never stacked), 54/46 from md up. */}
            <div className="flex h-full flex-row md:min-h-[min(82vh,660px)]">
              <div className="relative z-10 flex w-[55%] min-w-0 flex-col justify-center py-8 pl-4 pr-1 xs:pl-5 sm:py-12 sm:pl-8 md:w-[54%] md:py-12 md:pl-10 md:pr-4 lg:pl-14">
                {hero.eyebrow && <motion.div {...rise(0.1)}><Badge className="mb-4 max-w-full rounded-full border-line-strong bg-elevated/60 px-2.5 py-1 text-[0.6875rem] leading-tight text-ink-2 backdrop-blur sm:mb-6 sm:px-3 sm:py-1.5 sm:text-xs">{hero.eyebrow}</Badge></motion.div>}
                {hero.title && (
                  <motion.h1 {...rise(0.16)} className="bg-gradient-to-b from-ink to-ink-2 bg-clip-text text-[clamp(1.125rem,5.4vw,2.25rem)] font-bold leading-[1.08] tracking-[-0.03em] text-transparent [overflow-wrap:anywhere] md:text-display">
                    <Lines text={hero.title} />
                  </motion.h1>
                )}
                {hero.body && <motion.p {...rise(0.24)} className="mt-3 max-w-[32rem] text-[0.8125rem] leading-snug text-ink-2 sm:mt-5 sm:text-body md:mt-6 md:text-body-lg">{hero.body}</motion.p>}
                {(hero.cta || hero.cta2) && (
                  <motion.div {...rise(0.32)} className="mt-5 flex flex-col items-stretch gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 sm:gap-y-4 md:mt-9">
                    {hero.cta?.label && <Button href={hero.cta.href} size="lg" className="!h-11 !px-4 !text-[0.875rem] sm:!h-14 sm:!px-7 sm:!text-[1.0625rem]">{hero.cta.label}</Button>}
                    {hero.cta2 && <Button href={hero.cta2.href} variant="text" className="justify-start !whitespace-normal text-left text-[0.875rem] sm:!whitespace-nowrap sm:text-base">{hero.cta2.label}</Button>}
                  </motion.div>
                )}
              </div>
              <div className="relative min-h-[18rem] w-[45%] min-w-0 xs:min-h-[20rem] md:h-auto md:w-auto md:flex-1">
                {portrait ? <PortraitStage p={portrait} reduce={reduce} />
                  : scene ? <LazySpline scene={scene} poster={poster} className="absolute inset-0 h-full w-full" fallback={<HeroVisual className="absolute inset-0 h-full w-full" />} />
                  : <HeroVisual className="absolute inset-0 h-full w-full" />}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {cards.length > 0 && (
        <div className="relative z-10 mx-auto mt-16 flex max-w-6xl justify-center px-5 sm:mt-20 sm:px-8">
          <CardSlide items={cards} label="What I work on" />
        </div>
      )}
    </section>
  );
}
