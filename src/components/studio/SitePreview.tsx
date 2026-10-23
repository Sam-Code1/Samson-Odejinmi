"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Lock, Monitor, MousePointerClick, Smartphone } from "lucide-react";
import type { ProjectSite } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

type View = "desktop" | "phone" | "live";

/**
 * A website, presented: a browser frame with three views.
 *   Desktop: the whole page as one capture; it scrolls itself while hovered (and by wheel/touch), so a visitor can
 *            skim the site without leaving the portfolio. Reduced motion: no auto-scroll.
 *   Phone:   the site on a phone, in a device frame.
 *   Live:    the real site in a sandboxed frame, only when the site allows it and the owner turned it on. Loaded only
 *            when chosen (no third-party requests until then).
 */
export function SitePreview({ site, title }: { site: ProjectSite; title: string }) {
  const [view, setView] = useState<View>("desktop");
  const views: { id: View; label: string; icon: typeof Monitor }[] = [
    { id: "desktop", label: "Desktop", icon: Monitor },
    ...(site.mobile ? [{ id: "phone" as const, label: "Phone", icon: Smartphone }] : []),
    ...(site.live ? [{ id: "live" as const, label: "Try it live", icon: MousePointerClick }] : []),
  ];
  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {views.length > 1 ? (
          <div role="tablist" aria-label="Preview" className="inline-flex rounded-full border border-line p-1">
            {views.map(({ id, label, icon: Icon }) => (
              <button key={id} role="tab" type="button" aria-selected={view === id} onClick={() => setView(id)}
                className={cn("inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors", view === id ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink")}>
                <Icon aria-hidden className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        ) : <span />}
        <a href={site.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-action px-5 text-sm font-semibold text-on-action">Visit the website<ArrowUpRight aria-hidden className="h-4 w-4" /></a>
      </div>

      {view === "phone" && site.mobile ? (
        <div className="grid place-items-center rounded-[14px] border border-line bg-surface py-10">
          <div className="relative w-[min(300px,72vw)] overflow-hidden rounded-[38px] border-[10px] border-[#111] bg-[#111] shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]">
            <span aria-hidden className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[#111]" />
            <Image src={site.mobile.src} alt={`${title} on a phone`} width={site.mobile.w || 780} height={site.mobile.h || 1688} sizes="300px" className="block h-auto w-full rounded-[28px]" />
          </div>
        </div>
      ) : (
        <BrowserFrame domain={site.domain} url={site.url}>
          {view === "live" ? <LiveFrame site={site} title={title} /> : <ScrollShot site={site} title={title} />}
        </BrowserFrame>
      )}
      <figcaption className="mt-3 text-caption text-ink-3">
        {view === "live" ? "The live website, running inside this page. Links that leave the site open in a new tab." : view === "phone" ? "The site on a phone." : "Hover (or scroll inside) to move through the page. Captured from the live site."}
      </figcaption>
    </figure>
  );
}

function BrowserFrame({ domain, url, children }: { domain: string; url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_30px_80px_-40px_rgb(0_0_0/0.55)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span aria-hidden className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" /></span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="mx-auto flex min-w-0 max-w-md flex-1 items-center justify-center gap-1.5 rounded-md bg-canvas px-3 py-1 font-mono text-xs text-ink-2 hover:text-ink">
          <Lock aria-hidden className="h-3 w-3 shrink-0" /><span className="truncate">{domain}</span>
        </a>
        <span aria-hidden className="w-[54px]" />
      </div>
      {children}
    </div>
  );
}

/** The full-page capture in a 16:10 window; auto-scrolls while hovered, stops when the visitor scrolls. */
function ScrollShot({ site, title }: { site: ProjectSite; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const shot = site.tall ?? site.hero;
  const stop = () => cancelAnimationFrame(raf.current);
  const start = () => {
    const el = box.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stop();
    const step = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return;
      el.scrollTop += Math.max(1, el.clientHeight / 420);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => stop, []);
  return (
    <div ref={box} tabIndex={0} aria-label={`${title}: full page preview. Scroll to explore.`} onMouseEnter={start} onMouseLeave={stop} onWheel={stop} onTouchStart={stop}
      className="relative aspect-[16/10] overflow-y-auto overscroll-contain bg-canvas [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue">
      <Image src={shot.src} alt={`${title}: the website`} width={shot.w || 1200} height={shot.h || 750} sizes="(min-width: 1280px) 1200px, 100vw" priority className="block h-auto w-full" />
    </div>
  );
}

function LiveFrame({ site, title }: { site: ProjectSite; title: string }) {
  return (
    <div className="relative h-[min(75vh,760px)] bg-canvas">
      <p className="absolute inset-0 grid place-items-center p-6 text-center text-body-sm text-ink-3">Loading {site.domain}… If it doesn&apos;t appear, <a href={site.url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">open it in a new tab</a>.</p>
      <iframe src={site.url} title={`${title}: live website`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        className="relative h-full w-full border-0 bg-white" />
    </div>
  );
}
