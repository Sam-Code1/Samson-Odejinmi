"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

/**
 * Rows of skill tags drifting sideways in opposite directions. Pauses on hover/focus and with the button
 * (moving content needs a pause control). Reduced motion: a static, wrapped list (globals.css).
 * Each row is listed once for screen readers; the second copy that makes the loop seamless is hidden.
 */
export function SkillsMarquee({ rows, label }: { rows: string[][]; label: string }) {
  const [paused, setPaused] = React.useState(false);
  const filled = rows.filter((r) => r.length > 0);
  if (!filled.length) return null;

  return (
    <div>
      <div className="space-y-3 motion-reduce:mx-auto motion-reduce:max-w-page motion-reduce:px-5 sm:space-y-4 motion-reduce:sm:px-8 motion-reduce:lg:px-12">
        {filled.map((row, ri) => {
          // Short lists are repeated so one copy is always wider than the screen.
          const base = Array.from({ length: Math.max(1, Math.ceil(10 / row.length)) }, () => row).flat();
          const tags = (hidden: boolean) =>
            base.map((t, i) => (
              <li key={`${t}-${i}`} aria-hidden={hidden || i >= row.length || undefined}
                className={`mb-3 mr-3 shrink-0 whitespace-nowrap rounded-full border border-line-strong bg-elevated/50 px-4 py-2 text-label text-ink-2 sm:mr-4 sm:px-5 sm:py-2.5 motion-safe:mb-0 ${i >= row.length ? "motion-reduce:hidden" : ""}`}>
                {t}
              </li>
            ));
          return (
            <div key={ri} className="marquee" data-paused={paused}>
              <div className="marquee-track" data-reverse={ri % 2 === 1} style={{ "--marquee-duration": `${Math.max(28, base.length * 4)}s` } as React.CSSProperties}>
                <ul aria-label={ri === 0 ? label : undefined} className="flex motion-reduce:flex-wrap">{tags(false)}</ul>
                <ul aria-hidden className="marquee-dup flex">{tags(true)}</ul>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12">
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full px-1 text-caption text-ink-3 hover:text-ink motion-reduce:hidden"
      >
        {paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
        {paused ? "Play the skills ticker" : "Pause the skills ticker"}
      </button>
      </div>
    </div>
  );
}
