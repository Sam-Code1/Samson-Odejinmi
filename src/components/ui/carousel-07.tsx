"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
  useReducedMotion,
  type PanInfo,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { PlaceholderArt } from "@/components/visual/MediaFrame";
import { canOptimize } from "@/lib/cms/images";

/**
 * Stacked, draggable carousel (adapted from 21st.dev carousel-07).
 * Changes for this project: Tailwind v3 classes, project tokens instead of shadcn tokens,
 * placeholder art instead of stock photos, previous/next buttons and arrow keys (drag alone isn't accessible),
 * and a caption with a real link under the stack.
 */
export interface Slide {
  id: string;
  title: string;
  description: string;
  badge: string;
  href?: string;
  image?: { src: string; alt: string };
}

interface CarouselConfig {
  distanceDivisor: number;
  velocityDivisor: number;
  sensitivity: number;
  xMultiplier: number;
  yMultiplier: number;
  rotationMultiplier: number;
  scaleReduction: number;
}

const getCarouselConfig = (width: number): CarouselConfig => {
  if (width < 640) return { distanceDivisor: 120, velocityDivisor: 500, sensitivity: 180, xMultiplier: 90, yMultiplier: 20, rotationMultiplier: 8, scaleReduction: 0.06 };
  if (width < 1024) return { distanceDivisor: 160, velocityDivisor: 650, sensitivity: 220, xMultiplier: 130, yMultiplier: 30, rotationMultiplier: 10, scaleReduction: 0.09 };
  return { distanceDivisor: 200, velocityDivisor: 800, sensitivity: 250, xMultiplier: 170, yMultiplier: 40, rotationMultiplier: 12, scaleReduction: 0.12 };
};

export function CarouselStacked({ slides, className, label = "Carousel" }: { slides: Slide[]; className?: string; label?: string }) {
  const scrollProgress = useMotionValue(0);
  const startProgress = React.useRef(0);
  const reduce = useReducedMotion();
  const [windowWidth, setWindowWidth] = React.useState(0);
  const [active, setActive] = React.useState(0);
  const total = slides.length;

  React.useEffect(() => {
    setWindowWidth(window.innerWidth);
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const config = React.useMemo(() => getCarouselConfig(windowWidth), [windowWidth]);

  useMotionValueEvent(scrollProgress, "change", (v) => {
    setActive((((Math.round(v) % total) + total) % total) as number);
  });

  const settle = (target: number) => {
    if (reduce) scrollProgress.set(target);
    else animate(scrollProgress, target, { type: "spring", stiffness: 200, damping: 30, mass: 1 });
  };

  const go = (delta: number) => settle(Math.round(scrollProgress.get()) + delta);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const distanceShift = -info.offset.x / config.distanceDivisor;
    const velocityShift = -info.velocity.x / config.velocityDivisor;
    const shift = Math.max(-3, Math.min(3, Math.round(distanceShift + velocityShift)));
    settle(Math.round(startProgress.current) + shift);
  };

  if (total === 0) return null;
  const current = slides[active] ?? slides[0];

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
      className={cn("flex w-full select-none flex-col items-center overflow-hidden rounded-md py-6 focus-visible:outline-offset-0", className)}
    >
      <div className="relative flex h-80 w-full max-w-7xl items-center justify-center sm:h-[28rem] lg:h-[32rem]">
        {/* Transparent drag surface */}
        <motion.div
          aria-hidden
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0}
          onDragStart={() => { startProgress.current = scrollProgress.get(); }}
          onDrag={(_, info) => scrollProgress.set(scrollProgress.get() + -info.delta.x / config.sensitivity)}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 z-50 cursor-grab touch-pan-y active:cursor-grabbing"
        />
        {slides.map((slide, i) => (
          <Card key={slide.id} slide={slide} index={i} total={total} progress={scrollProgress} config={config} />
        ))}
      </div>

      {/* Caption + controls: the real, accessible way to move and to follow the link. */}
      <div className="mt-6 flex w-full max-w-xl flex-col items-center gap-5 px-4 text-center">
        <div aria-live="polite" className="min-h-[4.5rem]">
          <p className="text-h4">{current.title}</p>
          <p className="mt-1 text-body-sm text-ink-2">{current.description}</p>
          {current.href && (
            <Link href={current.href} className="mt-2 inline-block text-label"><span className="link-line pb-0.5">View</span></Link>
          )}
        </div>
        <div className="flex items-center gap-6">
          <button type="button" onClick={() => go(-1)} aria-label="Previous" className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink-2 transition-colors hover:border-ink hover:text-ink">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 4-6 6 6 6" /></svg>
          </button>
          <span className="text-caption tabular-nums text-ink-3">{active + 1} / {total}</span>
          <button type="button" onClick={() => go(1)} aria-label="Next" className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink-2 transition-colors hover:border-ink hover:text-ink">
            <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m8 4 6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ slide, index, total, progress, config }: { slide: Slide; index: number; total: number; progress: MotionValue<number>; config: CarouselConfig }) {
  const offset = useTransform(progress, (p) => {
    let diff = (index - p) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  });
  const x = useTransform(offset, (o) => o * config.xMultiplier);
  const rotate = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : o * config.rotationMultiplier));
  const y = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : Math.abs(o) * config.yMultiplier));
  const scale = useTransform(offset, (o) => 1 - Math.abs(o) * config.scaleReduction);
  const opacity = useTransform(offset, [-total / 2, -total / 2 + 0.5, 0, total / 2 - 0.5, total / 2], [0, 1, 1, 1, 0]);
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10));
  const dim = useTransform(offset, [-2, -0.5, 0, 0.5, 2], [0.5, 0.2, 0, 0.2, 0.5]);
  const textOpacity = useTransform(offset, [-0.5, 0, 0.5], [0, 1, 0]);

  return (
    <motion.div
      style={{ x, rotate, y, scale, opacity, zIndex }}
      className={cn("group pointer-events-none absolute overflow-hidden rounded-2xl bg-surface shadow-[0_30px_60px_-30px_rgb(var(--ink)/0.45)] ring-1 ring-line", "h-56 w-44 sm:h-80 sm:w-56 lg:h-96 lg:w-64")}
    >
      {slide.image ? (
        <Image src={slide.image.src} alt={slide.image.alt} fill sizes="16rem" unoptimized={!canOptimize(slide.image.src)} className="object-cover transition-transform duration-700 group-hover:scale-110" />
      ) : (
        <div className="absolute inset-0"><PlaceholderArt variant={index} /></div>
      )}
      <motion.div style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-black" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <Badge className="absolute right-3 top-3 border-transparent bg-white/95 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-black backdrop-blur-md sm:right-5 sm:top-5 sm:px-3 sm:py-1 lg:right-6 lg:top-6">
        {slide.badge}
      </Badge>

      <div className="absolute bottom-5 left-3 right-3 text-center text-white sm:bottom-8 sm:left-5 sm:right-5 sm:text-left lg:bottom-10 lg:left-6 lg:right-6">
        <motion.p style={{ opacity: textOpacity }} className="mb-0.5 text-sm font-semibold leading-tight drop-shadow-md sm:mb-1 sm:text-lg lg:text-xl">{slide.title}</motion.p>
        <motion.p style={{ opacity: textOpacity }} className="line-clamp-2 hidden text-xs font-medium text-white/80 sm:block">{slide.description}</motion.p>
      </div>
    </motion.div>
  );
}

export default CarouselStacked;
