"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewGroup, PreviewPage } from "@/content/book-previews";

const GROUPS: ("All" | PreviewGroup)[] = ["All", "Start", "Learn", "Practice", "Author"];
const GROUP_LABEL: Record<string, string> = { All: "Every page", Start: "The start", Learn: "Learn", Practice: "Practice", Author: "The author" };
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "Look inside": the real pages of the book on a dark stage. A cover-flow of pages you can swipe, drag, click or flip with
 * the arrow keys; chips to jump to a part of the book; a thumbnail strip; a full-screen reader with zoom.
 */
export function LookInside({ pages, bookName }: { pages: PreviewPage[]; bookName: string }) {
  const [group, setGroup] = useState<"All" | PreviewGroup>("All");
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const list = useMemo(() => (group === "All" ? pages : pages.filter((p) => p.group === group)), [pages, group]);
  const n = list.length;
  const cur = list[Math.min(i, n - 1)];
  const go = useCallback((to: number) => setI(Math.max(0, Math.min(n - 1, to))), [n]);
  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g, g === "All" ? pages.length : pages.filter((p) => p.group === g).length])), [pages]);

  const drag = useRef<{ x: number; id: number } | null>(null);
  const tilt = useRef<HTMLDivElement | null>(null);
  const strip = useRef<HTMLUListElement | null>(null);

  // Keep the active thumbnail in view without scrolling the page.
  useEffect(() => {
    const el = strip.current?.children[i] as HTMLElement | undefined;
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [i, group]);

  if (!cur) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(n - 1); }
    else if (e.key === "Enter" && e.target === e.currentTarget) setOpen(true);
  };
  const tiltMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !tilt.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    tilt.current.style.transform = `rotateY(${px * 9}deg) rotateX(${-py * 7}deg)`;
  };
  const tiltEnd = () => { if (tilt.current) tilt.current.style.transform = ""; };

  return (
    <div>
      {/* Parts of the book */}
      <div role="group" aria-label="Jump to a part of the book" className="mb-6 flex flex-wrap gap-2">
        {GROUPS.filter((g) => counts[g] > 0).map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => { setGroup(g); setI(0); }}
            className={cn("inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
              group === g ? "border-transparent bg-[rgb(var(--action))] text-[rgb(var(--on-action))]" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink")}>
            {GROUP_LABEL[g]}<span className={cn("font-mono text-[0.7rem]", group === g ? "opacity-80" : "text-ink-3")}>{counts[g]}</span>
          </button>
        ))}
      </div>

      {/* The stage */}
      <div className="theme-night fa-blueprint relative overflow-hidden rounded-[14px] border border-line bg-canvas">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[rgb(var(--node)/0.10)] to-transparent" />
        <div
          role="region" aria-roledescription="carousel" aria-label={`Pages from ${bookName}`} tabIndex={0} onKeyDown={onKey}
          onPointerDown={(e) => { if (e.pointerType === "mouse" && e.button !== 0) return; drag.current = { x: e.clientX, id: e.pointerId }; }}
          onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && e.pointerId === d.id) { const dx = e.clientX - d.x; if (dx < -40) go(i + 1); else if (dx > 40) go(i - 1); } }}
          onPointerCancel={() => { drag.current = null; }}
          className="relative mx-auto select-none outline-none [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]"
          style={{ ["--pw" as string]: "clamp(10.5rem, 58vw, 19rem)", height: "calc(var(--pw) * 1.5 + 4rem)", perspective: "1500px" }}
        >
          {list.map((p, k) => {
            const off = k - i, a = Math.abs(off);
            if (a > 3) return null;
            const active = off === 0;
            const deg = Math.max(-58, Math.min(58, -off * 34));
            return (
              <div key={p.src} className="absolute left-1/2 top-8 motion-reduce:!transition-none" aria-hidden={!active}
                style={{
                  width: "var(--pw)", zIndex: 20 - a, opacity: a > 2 ? 0 : 1, filter: a === 0 ? undefined : `brightness(${a === 1 ? 0.78 : 0.5})`,
                  transform: `translateX(-50%) translateX(${Math.sign(off) * (a === 0 ? 0 : 64 + (a - 1) * 34)}%) translateZ(${-a * 90}px) rotateY(${deg}deg) scale(${1 - a * 0.06})`,
                  transition: "transform 600ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease, filter 400ms ease", pointerEvents: a > 2 ? "none" : "auto",
                }}>
                <div ref={active ? tilt : undefined} onPointerMove={active ? tiltMove : undefined} onPointerLeave={active ? tiltEnd : undefined}
                  className="relative aspect-[2/3] w-full transition-transform duration-200 ease-out [transform-style:preserve-3d]">
                  <button type="button" tabIndex={active ? 0 : -1}
                    onClick={() => (active ? setOpen(true) : go(k))}
                    aria-label={active ? `Open page full screen: ${p.title}` : `Go to page: ${p.title}`}
                    className={cn("group absolute inset-0 overflow-hidden rounded-[3px] bg-[#f3efe6] outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--focus))]", active ? "cursor-zoom-in" : "cursor-pointer")}
                    style={{ boxShadow: active ? "0 40px 70px -24px rgb(0 0 0 / 0.75), 0 0 0 1px rgb(255 255 255 / 0.06)" : "0 24px 40px -22px rgb(0 0 0 / 0.7)" }}>
                    <Image src={p.src} alt={`${bookName}, page: ${p.title}`} fill sizes="(min-width: 1024px) 19rem, 58vw" loading={a <= 2 ? "eager" : "lazy"} draggable={false} className="object-cover" />
                    {/* the spine, and a light sweep across the paper */}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/25 to-transparent" />
                    <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.10] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    {active && <span aria-hidden className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Expand className="h-4 w-4" /></span>}
                  </button>
                </div>
              </div>
            );
          })}

          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous page"
            className="absolute left-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-canvas/80 text-ink backdrop-blur transition-opacity hover:border-ink disabled:opacity-30 sm:left-6"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next page"
            className="absolute right-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-canvas/80 text-ink backdrop-blur transition-opacity hover:border-ink disabled:opacity-30 sm:right-6"><ChevronRight className="h-5 w-5" /></button>
        </div>

        {/* Caption */}
        <div className="relative px-5 pb-6 text-center sm:px-10">
          <div key={cur.src} className="fa-rise mx-auto max-w-xl" aria-live="polite">
            <p className="fa-label">{GROUP_LABEL[cur.group]} · <span className="tabular-nums">{pad(Math.min(i, n - 1) + 1)} / {pad(n)}</span></p>
            <h3 className="mt-2 text-h3">{cur.title}</h3>
            <p className="mt-2 text-body-sm text-ink-2">{cur.note}</p>
          </div>
          {/* The path: idea → understanding → creation, with a node for where you are */}
          <div aria-hidden className="relative mx-auto mt-6 h-3 max-w-sm">
            <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <span className="absolute left-0 top-1/2 h-px bg-[rgb(var(--path-start))] transition-[width] duration-500" style={{ width: `${n > 1 ? (Math.min(i, n - 1) / (n - 1)) * 100 : 100}%` }} />
            <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-[rgb(var(--path-start))] bg-canvas transition-[left] duration-500" style={{ left: `${n > 1 ? (Math.min(i, n - 1) / (n - 1)) * 100 : 100}%` }} />
          </div>
          <p className="mt-4 text-caption text-ink-3"><span className="hidden sm:inline">Use ← → to flip · click a page to read it full screen</span><span className="sm:hidden">Swipe to flip · tap a page to read it</span></p>
        </div>
      </div>

      {/* Thumbnails */}
      <ul ref={strip} aria-label="All pages" className="mt-5 flex snap-x gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {list.map((p, k) => (
          <li key={p.src} className="shrink-0 snap-center">
            <button type="button" onClick={() => go(k)} aria-label={`Page ${k + 1}: ${p.title}`} aria-current={k === i ? "true" : undefined}
              className={cn("relative block h-[5.25rem] w-14 overflow-hidden rounded-[3px] border bg-[#f3efe6] transition-all sm:h-[6.75rem] sm:w-[4.5rem]", k === i ? "-translate-y-1 border-[rgb(var(--node))] ring-2 ring-[rgb(var(--node)/0.4)]" : "border-line opacity-70 hover:opacity-100")}>
              <Image src={p.src} alt="" fill sizes="72px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>

      {open && <Reader pages={list} index={Math.min(i, n - 1)} onIndex={go} onClose={() => setOpen(false)} bookName={bookName} />}
    </div>
  );
}

/** Full-screen reader: one page at a time, big, with zoom. Esc closes; arrows flip. */
function Reader({ pages, index, onIndex, onClose, bookName }: { pages: PreviewPage[]; index: number; onIndex: (n: number) => void; onClose: () => void; bookName: string }) {
  const [zoom, setZoom] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const p = pages[index];

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prevOverflow; before?.focus?.(); };
  }, []);
  useEffect(() => { setZoom(false); }, [index]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndex(index + 1);
      else if (e.key === "ArrowLeft") onIndex(index - 1);
      else if (e.key === "Tab") { // keep focus inside the reader
        const f = Array.from(document.querySelectorAll<HTMLElement>("#reader button:not([disabled])"));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [index, onClose, onIndex]);

  const btn = "grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30";
  return createPortal(
    <div id="reader" role="dialog" aria-modal="true" aria-label={`${bookName}, page ${index + 1} of ${pages.length}: ${p.title}`} className="fixed inset-0 z-[60] flex flex-col bg-[rgb(5_7_13/0.97)] text-white backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-white/60">{bookName} · {pad(index + 1)} / {pad(pages.length)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setZoom((z) => !z)} aria-pressed={zoom} aria-label={zoom ? "Zoom out" : "Zoom in"} className={btn}>{zoom ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}</button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className={btn}><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0 overflow-auto px-2", zoom ? "" : "flex items-center justify-center")} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the reader sizes the original page itself (zoom) */}
          <img src={p.src} alt={`${bookName}, page: ${p.title}`} onClick={() => setZoom((z) => !z)} draggable={false}
            className={cn("rounded-[3px] bg-[#f3efe6] shadow-2xl", zoom ? "mx-auto my-2 w-[min(1200px,200vw)] max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in object-contain")} />
        </div>
        <button type="button" onClick={() => onIndex(index - 1)} disabled={index === 0} aria-label="Previous page" className={cn(btn, "absolute left-3 top-1/2 -translate-y-1/2 sm:left-6")}><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => onIndex(index + 1)} disabled={index === pages.length - 1} aria-label="Next page" className={cn(btn, "absolute right-3 top-1/2 -translate-y-1/2 sm:right-6")}><ChevronRight className="h-5 w-5" /></button>
      </div>
      <p className="px-4 py-3 text-center text-sm text-white/70">{p.note}</p>
    </div>,
    document.body,
  );
}
