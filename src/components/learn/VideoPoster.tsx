"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * Click-to-play poster for a lesson video. Shows the lesson thumbnail and only loads the (view-only) player when the
 * student presses play. Purely presentational: access was already checked on the server before this rendered.
 */
export function VideoPoster({ thumbnail, title, children }: { thumbnail: string; title: string; children: React.ReactNode }) {
  const [playing, setPlaying] = useState(false);
  if (playing) return <>{children}</>;
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-quiet group-hover:scale-[1.02]" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <span aria-hidden className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-105">
        <Play className="ml-1 h-7 w-7" fill="currentColor" />
      </span>
    </button>
  );
}
