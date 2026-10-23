import Link from "next/link";
import { cn } from "@/lib/utils";

export type BarRow = { key: string; label: string; value: number; display: string; hint?: string; href?: string };

/**
 * Ranked horizontal bars ("what's leading"): label and value in text, the bar shows the share of the leader. Bars are
 * 8px, rounded at the data end, on a faint track. Long labels truncate with the full text on hover.
 */
export function BarList({ rows, slot = 1, empty = "Nothing to show yet.", className, limit = 8 }: {
  rows: BarRow[]; slot?: 1 | 2 | 3 | 4; empty?: string; className?: string; limit?: number;
}) {
  const shown = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  if (!shown.length) return <p className="py-6 text-center text-body-sm text-ink-3">{empty}</p>;
  const max = Math.max(...shown.map((r) => r.value), 1);
  return (
    <ol className={cn("space-y-3.5", className)}>
      {shown.map((r, i) => {
        const label = <span className="truncate" title={r.label}>{r.label}</span>;
        return (
          <li key={r.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-body-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="ad-num w-4 shrink-0 text-caption text-ink-3">{i + 1}</span>
                {r.href ? <Link href={r.href} className="min-w-0 truncate font-medium hover:underline" title={r.label}>{r.label}</Link> : <span className="flex min-w-0 font-medium">{label}</span>}
              </span>
              <span className="ad-num shrink-0 font-semibold">{r.display}</span>
            </div>
            <div className="ml-6 mt-1.5 flex items-center gap-3">
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`, background: `var(--c${slot})` }} />
              </div>
              {r.hint && <span className="shrink-0 text-caption text-ink-3">{r.hint}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
