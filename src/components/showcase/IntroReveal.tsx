"use client";

import * as React from "react";

/**
 * Homepage intro: a dot that stretches, then the CMS words one after another, then the page.
 *
 * - Once per browser session, decided before first paint by the <head> script in src/lib/intro-script.ts, which marks
 *   <html data-intro="play|skip">. Repeat visits and reduced-motion users get "skip", so the overlay never shows.
 * - In-app navigation back to the homepage doesn't set "play", so the overlay isn't rendered then.
 * - The whole animation is CSS (globals.css), so it also ends without JavaScript. Skip button, Escape or a click end it early.
 */

const noop = () => () => {};
const readPlaying = () => document.documentElement.dataset.intro === "play";

export function IntroReveal({ words }: { words: string[] }) {
  const playing = React.useSyncExternalStore(noop, readPlaying, () => true);
  const [ended, setEnded] = React.useState(false);

  const end = React.useCallback(() => {
    document.documentElement.dataset.intro = "done";
    setEnded(true);
  }, []);

  React.useEffect(() => {
    if (!playing || ended) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") end(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, ended, end]);

  if (!words.length || !playing || ended) return null;

  return (
    <>
      <div
        className="intro-overlay theme-night fixed inset-0 z-[90] flex items-center justify-center overflow-hidden"
        style={{ "--intro-n": words.length } as React.CSSProperties}
        onClick={end}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) end(); }}
      >
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--ink)/0.14),transparent)]" />
        <span aria-hidden className="intro-dot absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-ink" />
        <div aria-hidden className="relative grid w-full place-items-center px-5">
          {words.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="intro-word text-chrome col-start-1 row-start-1 max-w-full break-words text-center font-extrabold uppercase leading-none tracking-[-0.04em]"
              style={{ "--intro-i": i, fontSize: `min(${Math.min(20, 150 / Math.max(w.length, 1))}vw, 11rem)` } as React.CSSProperties}
            >
              {w}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); end(); }}
          className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 inline-flex min-h-[44px] items-center rounded-full border border-line-strong px-5 text-label text-ink-2 transition-colors hover:border-ink hover:text-ink"
        >
          Skip intro
        </button>
      </div>
    </>
  );
}
