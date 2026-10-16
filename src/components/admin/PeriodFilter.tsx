import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS } from "@/lib/admin/marketing-stats";

/** Period links (server-rendered, no client JavaScript). */
export function PeriodFilter({ current, basePath }: { current: number; basePath: string }) {
  return (
    <nav aria-label="Period" className="flex flex-wrap gap-2">
      {Object.entries(PERIODS).map(([v, label]) => (
        <Link key={v} href={`${basePath}?days=${v}`} aria-current={Number(v) === current ? "true" : undefined}
          className={cn("inline-flex min-h-[40px] items-center rounded border px-3 text-label transition-colors", Number(v) === current ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:text-ink")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Horizontal bar for a share of a total (pure CSS, accessible text alongside). */
export function ShareBar({ value, max, label }: { value: number; max: number; label: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface"><div className="thread-solid h-full rounded-full transition-[width] duration-slow ease-quiet motion-reduce:transition-none" style={{ width: `${w}%` }} /></div>
      <span className="w-24 shrink-0 text-right text-caption tabular-nums text-ink-2">{label}</span>
    </div>
  );
}
