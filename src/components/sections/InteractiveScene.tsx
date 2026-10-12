"use client";

import { useEffect, useRef, useState } from "react";
import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card";
import { Spotlight } from "@/components/ui/spotlight";
import { Button } from "@/components/ui/Button";
import type { Cta } from "@/lib/cms/types";

/**
 * Homepage "Interactive 3D" block (from the 21st.dev SplineSceneBasic demo). Changes for this project: content comes
 * from the CMS, the card is a `.theme-night` band so it stays dark in both themes using the project tokens, it stacks
 * on mobile, and the heavy Spline runtime only loads once the card scrolls near the viewport.
 */
export function InteractiveScene({ eyebrow, title, body, cta, sceneUrl }: { eyebrow: string | null; title: string | null; body: string | null; cta: Cta; sceneUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const load = () => { if (done) return; done = true; setNear(true); cleanup(); };
    // IntersectionObserver first, plus a passive scroll/resize check for browsers that throttle observers.
    const check = () => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight + 300 && r.bottom > -300) load(); };
    const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) load(); }, { rootMargin: "300px 0px" }) : null;
    io?.observe(el);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    function cleanup() { io?.disconnect(); window.removeEventListener("scroll", check); window.removeEventListener("resize", check); }
    check();
    return cleanup;
  }, []);

  return (
    <Card ref={ref} className="theme-night relative w-full overflow-hidden border-line bg-canvas md:h-[500px]">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />
      <span aria-hidden className="thread absolute inset-x-0 top-0 h-px" />
      <div className="flex h-full flex-col md:flex-row">
        <div className="relative z-10 flex flex-col justify-center p-8 sm:p-10 md:flex-1">
          {eyebrow && <p className="text-label text-ink-3">{eyebrow}</p>}
          {title && <h2 className="mt-3 bg-gradient-to-b from-ink to-ink-2 bg-clip-text text-h1 text-transparent">{title}</h2>}
          {body && <p className="mt-5 max-w-lg text-body-lg text-ink-2">{body}</p>}
          {cta?.label && <div className="mt-8"><Button href={cta.href} variant="text">{cta.label}</Button></div>}
        </div>
        <div className="relative h-80 flex-none sm:h-96 md:h-auto md:flex-1" aria-label="Interactive 3D scene" role="group">
          {near ? <SplineScene scene={sceneUrl} className="h-full w-full" /> : <div className="flex h-full w-full items-center justify-center"><span className="loader" aria-hidden /></div>}
        </div>
      </div>
    </Card>
  );
}
