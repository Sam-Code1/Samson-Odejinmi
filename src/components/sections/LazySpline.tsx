"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { SplineScene } from "@/components/ui/splite";
import { cn } from "@/lib/utils";

/**
 * The hero's 3D scene, loaded so it never blocks the page:
 *   - a still poster (or the static artwork) shows immediately and is the only thing rendered for people who prefer
 *     reduced motion or have Data Saver on;
 *   - otherwise the (heavy) Spline runtime downloads only once the box is near the screen AND the browser is idle,
 *     then fades in over the poster once the scene has actually loaded.
 */
export function LazySpline({ scene, className, label = "Interactive 3D scene", poster, fallback }: {
  scene: string; className?: string; label?: string; poster?: string | null; fallback?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"wait" | "load" | "static">("wait");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (reduce || saveData) { setMode("static"); return; }
    let done = false, idle: number | undefined;
    const w = window as Window & typeof globalThis;
    const idleCb = (cb: () => void) => (typeof w.requestIdleCallback === "function" ? w.requestIdleCallback(cb, { timeout: 2500 }) : w.setTimeout(cb, 600));
    const go = () => { if (done) return; done = true; cleanup(); idle = idleCb(() => setMode("load")) as unknown as number; };
    const check = () => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight + 300 && r.bottom > -300) go(); };
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) go(); }, { rootMargin: "300px 0px" }) : null;
    function cleanup() { io?.disconnect(); window.removeEventListener("scroll", check); window.removeEventListener("resize", check); }
    io?.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    check();
    return () => { cleanup(); if (idle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idle); };
  }, []);

  const still = poster
    ? <Image src={poster} alt="" fill priority sizes="(min-width: 768px) 46vw, 45vw" className="object-cover object-center" />
    : fallback ?? null;

  return (
    <div ref={ref} role="group" aria-label={label} className={cn("relative overflow-hidden", className)}>
      {/* Still layer: the poster/artwork, visible until the live scene has loaded (and forever in static mode). */}
      <div aria-hidden className={cn("absolute inset-0 transition-opacity duration-slow ease-quiet motion-reduce:transition-none", loaded ? "opacity-0" : "opacity-100")}>
        {still ?? (mode !== "static" && <div className="flex h-full w-full items-center justify-center"><span className="loader" aria-hidden /></div>)}
      </div>
      {mode === "load" && (
        <div className={cn("absolute inset-0 transition-opacity duration-slow ease-quiet motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}>
          <SplineScene scene={scene} className="h-full w-full" onLoad={() => setLoaded(true)} />
        </div>
      )}
    </div>
  );
}
