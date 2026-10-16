"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const BlockBreaker = dynamic(() => import("./BlockBreaker").then((m) => m.BlockBreaker), {
  ssr: false,
  loading: () => <GameFrame />,
});

/** Same footprint as the game, so nothing jumps when it loads. */
function GameFrame() {
  return <div className="aspect-[4/5] w-full rounded-xl border border-line bg-surface/40 sm:aspect-[16/9]" />;
}

/** Loads the game only once it's about to scroll into view. */
export function GameLoader({ lines }: { lines: string[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [near, setNear] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return <div ref={ref}>{near ? <BlockBreaker lines={lines} /> : <GameFrame />}</div>;
}
