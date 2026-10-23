"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ExternalLink, Play, X } from "lucide-react";
import type { GalleryItem } from "@/lib/gallery-categories";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  "environment-design": "Environment design", "product-animation": "Product animation", "3d-animation": "3D animation",
  "graphic-design": "Graphic design", "video-editing": "Video editing", "ai-automation": "AI automation", "software-engineering": "Software engineering",
};
const ratio = (i: GalleryItem) => (i.width && i.height ? `${i.width} / ${i.height}` : "4 / 3");
const remote = (src: string) => /^https?:/.test(src);

/** One piece of work. A button: it opens the viewer. Videos preview silently on hover (desktop). */
function Tile({ item, onOpen, sizes, priority, fixedRatio }: { item: GalleryItem; onOpen: () => void; sizes: string; priority?: boolean; fixedRatio?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${item.title}`}
      onMouseEnter={() => video.current?.play().catch(() => undefined)} onMouseLeave={() => { video.current?.pause(); }}
      className="st-tile group relative block w-full overflow-hidden rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]"
      style={{ aspectRatio: fixedRatio ?? ratio(item), backgroundColor: item.tone ?? "rgb(var(--surface))" }}>
      {item.kind === "video" ? (
        <>
          <video ref={video} src={item.src} poster={item.poster ?? undefined} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-[3px] bg-black/55 px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white backdrop-blur"><Play aria-hidden className="h-3 w-3 fill-current" />Video</span>
        </>
      ) : (
        <Image src={item.src} alt={item.title} fill sizes={sizes} priority={priority} unoptimized={remote(item.src)} className="object-cover" />
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 pt-12 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-white/70">{LABEL[item.category]}{item.series ? ` · ${item.series}` : ""}</span>
        <span className="mt-1 block text-sm font-semibold leading-snug text-white">{item.title}</span>
      </span>
    </button>
  );
}

/** Full-screen viewer: arrows / ← → / Esc, focus kept inside, body scroll locked. */
function Viewer({ items, index, onClose, onIndex }: { items: GalleryItem[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const item = items[index];
  const close = useRef<HTMLButtonElement>(null);
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex]);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    close.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [go, onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={item.title} className="fixed inset-0 z-[80] flex flex-col bg-[#0b0b0c]/[0.97] text-[#f2f0eb]">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] text-white/60">{String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")} · {LABEL[item.category]}</p>
        <button ref={close} type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-md hover:bg-white/10"><X aria-hidden className="h-5 w-5" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
        {item.kind === "video"
          ? <video key={item.src} src={item.src} poster={item.poster ?? undefined} controls autoPlay playsInline className="max-h-full max-w-full rounded-[4px]" />
          : <div className="relative h-full w-full"><Image key={item.src} src={item.src} alt={item.title} fill sizes="100vw" loading="eager" unoptimized={remote(item.src)} className="object-contain" /></div>}
        {items.length > 1 && <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:left-4"><ArrowLeft aria-hidden className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:right-4"><ArrowRight aria-hidden className="h-5 w-5" /></button>
        </>}
      </div>
      <div className="px-4 pb-5 pt-3 sm:px-6">
        <p className="text-lg font-semibold">{item.title}</p>
        {item.description && <p className="mt-1 max-w-2xl text-sm text-white/70">{item.description}</p>}
        {item.linkUrl && <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-[#8ea8ff] hover:underline">Visit the live site<ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The work, in one of three layouts:
 *   "masonry"  magazine columns, every piece at its true shape (the /work page);
 *   "feature"  an editorial mix: one large lead piece and a grid beside it (home "Selected work");
 *   "strip"    a horizontal, swipeable row (a discipline on the home page).
 */
export function WorkGallery({ items, layout = "masonry", className }: { items: GalleryItem[]; layout?: "masonry" | "feature" | "strip"; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;
  const viewer = open !== null && <Viewer items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />;

  if (layout === "strip") {
    return (
      <>
        <ul className={cn("st-strip -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6", className)}>
          {items.map((it, i) => (
            <li key={it.id} className="shrink-0" style={{ width: `min(${it.width && it.height && it.width > it.height ? 30 : 19}rem, 78vw)` }}>
              <Tile item={it} onOpen={() => setOpen(i)} sizes="(min-width: 1024px) 30rem, 78vw" />
            </li>
          ))}
        </ul>
        {viewer}
      </>
    );
  }

  if (layout === "feature") {
    const [lead, ...rest] = items;
    return (
      <>
        <div className={cn("grid gap-4 lg:grid-cols-12", className)}>
          <div className="lg:col-span-7"><Tile item={lead} onOpen={() => setOpen(0)} sizes="(min-width: 1024px) 56vw, 100vw" priority fixedRatio="4 / 3" /></div>
          <ul className="grid grid-cols-2 gap-4 lg:col-span-5">
            {rest.slice(0, 4).map((it, i) => <li key={it.id}><Tile item={it} onOpen={() => setOpen(i + 1)} sizes="(min-width: 1024px) 20vw, 50vw" fixedRatio="1 / 1" /></li>)}
          </ul>
          {rest.length > 4 && (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-12">
              {rest.slice(4, 8).map((it, i) => <li key={it.id}><Tile item={it} onOpen={() => setOpen(i + 5)} sizes="(min-width: 1024px) 24vw, 50vw" fixedRatio="4 / 5" /></li>)}
            </ul>
          )}
        </div>
        {viewer}
      </>
    );
  }

  return (
    <>
      <ul className={cn("columns-1 gap-4 xs:columns-2 lg:columns-3 2xl:columns-4", className)}>
        {items.map((it, i) => (
          <li key={it.id} className="mb-4 break-inside-avoid st-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
            <Tile item={it} onOpen={() => setOpen(i)} sizes="(min-width: 1536px) 24vw, (min-width: 1024px) 32vw, (min-width: 430px) 48vw, 100vw" priority={i < 3} />
          </li>
        ))}
      </ul>
      {viewer}
    </>
  );
}
