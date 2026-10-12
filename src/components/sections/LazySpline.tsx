"use client";

import { useEffect, useRef, useState } from "react";
import { SplineScene } from "@/components/ui/splite";
import { cn } from "@/lib/utils";

/**
 * Spline scene that only downloads the (heavy) runtime once its box is on or near the screen.
 * IntersectionObserver first, plus a passive scroll/resize check for browsers that throttle observers.
 */
export function LazySpline({ scene, className, label = "Interactive 3D scene" }: { scene: string; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const check = () => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight + 300 && r.bottom > -300) load(); };
    const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) load(); }, { rootMargin: "300px 0px" }) : null;
    function cleanup() { io?.disconnect(); window.removeEventListener("scroll", check); window.removeEventListener("resize", check); }
    function load() { if (done) return; done = true; setNear(true); cleanup(); }
    io?.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    check();
    return cleanup;
  }, []);

  return (
    <div ref={ref} role="group" aria-label={label} className={cn("relative", className)}>
      {near ? <SplineScene scene={scene} className="h-full w-full" /> : <div className="flex h-full w-full items-center justify-center"><span className="loader" aria-hidden /></div>}
    </div>
  );
}
