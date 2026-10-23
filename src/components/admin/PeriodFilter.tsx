import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS } from "@/lib/admin/marketing-stats";

const SHORT: Record<string, string> = { "7": "7 days", "30": "30 days", "90": "90 days", "365": "12 months" };

/** Period links (server-rendered, no client JavaScript), as a segmented control. */
export function PeriodFilter({ current, basePath }: { current: number; basePath: string }) {
  return (
    <nav aria-label="Period" className="max-w-full overflow-x-auto [scrollbar-width:none]" data-scroll>
      <div className="inline-flex min-w-max rounded-xl border border-line bg-surface/60 p-1">
        {Object.entries(PERIODS).map(([v, label]) => (
          <Link key={v} href={`${basePath}?days=${v}`} aria-current={Number(v) === current ? "true" : undefined} title={label}
            className={cn("inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-[0.8125rem] font-semibold transition-colors", Number(v) === current ? "bg-elevated text-ink shadow-[var(--ad-shadow)]" : "text-ink-3 hover:text-ink")}>
            {SHORT[v] ?? label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Horizontal bar for a share of a total (pure CSS, accessible text alongside). */
export function ShareBar({ value, max, label }: { value: number; max: number; label: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-[var(--c1)] transition-[width] duration-slow ease-quiet motion-reduce:transition-none" style={{ width: `${w}%` }} /></div>
      <span className="w-24 shrink-0 text-right text-caption tabular-nums text-ink-2">{label}</span>
    </div>
  );
}
