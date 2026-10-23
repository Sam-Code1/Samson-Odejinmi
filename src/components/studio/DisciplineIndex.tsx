"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { GalleryItem } from "@/lib/gallery-categories";
import { cn } from "@/lib/utils";

type Row = { id: string; label: string; group: string; blurb: string; items: GalleryItem[] };

/**
 * The disciplines as a numbered index (a classic studio "work index"). Hovering a row previews that discipline's
 * work beside the list (desktop); every row links to the filtered gallery. Counts are the real number of pieces.
 */
export function DisciplineIndex({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState(0);
  const preview = rows[active]?.items.find((i) => i.kind === "image" || i.poster);
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <ol className="border-t border-line lg:col-span-7" onMouseLeave={() => undefined}>
        {rows.map((r, i) => (
          <li key={r.id} className="border-b border-line">
            <Link href={`/work?c=${r.id}`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)}
              className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-3 py-5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:py-6">
              <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className={cn("block text-[clamp(1.5rem,1.1rem+1.6vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.035em] transition-[transform,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2", active === i ? "text-ink" : "text-ink-2")}>{r.label}</span>
                <span className="mt-2 block max-w-md text-sm text-ink-3 lg:hidden">{r.blurb}</span>
              </span>
              <span className="flex items-center gap-2 font-mono text-xs text-ink-3">
                {r.items.length ? `${r.items.length} ${r.items.length === 1 ? "piece" : "pieces"}` : "Adding soon"}
                <ArrowUpRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="hidden lg:col-span-5 lg:block">
        <div className="sticky top-28">
          <div className="fa-frame relative aspect-[4/3] overflow-hidden rounded-[4px] bg-surface" style={{ backgroundColor: preview?.tone ?? undefined }}>
            {preview
              ? <Image key={preview.id} src={preview.poster ?? preview.src} alt="" fill sizes="36vw" className="st-rise object-cover" unoptimized={/^https?:/.test(preview.poster ?? preview.src)} />
              : <div className="absolute inset-0 grid place-items-center text-sm text-ink-3">New work is being added here.</div>}
          </div>
          <p className="fa-label mt-4">{rows[active]?.group}</p>
          <p className="mt-2 max-w-sm text-body-sm text-ink-2">{rows[active]?.blurb}</p>
        </div>
      </div>
    </div>
  );
}
