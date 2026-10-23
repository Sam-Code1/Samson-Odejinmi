import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta } from "./charts/Delta";
import { Sparkline } from "./charts/Sparkline";

type Icon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * A KPI tile: label, value, optional change vs the previous period, optional 12-point sparkline. Long values (a few
 * currencies, long words) wrap inside the card instead of spilling out of it.
 */
export function StatCard({ label, value, hint, href, icon: I, delta, spark, slot = 1, className }: {
  label: string; value: string | number; hint?: string; href?: string; icon?: Icon;
  delta?: { cur: number; prev: number; goodWhenDown?: boolean }; spark?: number[]; slot?: 1 | 2 | 3 | 4; className?: string;
}) {
  const v = String(value);
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[0.8125rem] font-medium text-ink-2">{label}</p>
        {I ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-ink-2"><I className="h-4 w-4" strokeWidth={1.6} /></span>
          : href ? <ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" /> : null}
      </div>
      <p className={cn("mt-3 font-semibold leading-[1.05] tracking-[-0.03em]", v.length > 18 ? "text-[1.125rem] sm:text-[1.25rem]" : v.length > 9 ? "text-[1.25rem] sm:text-[1.5rem]" : "text-[1.5rem] sm:text-[1.875rem]")}>{v}</p>
      {(delta || hint) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta && <Delta {...delta} />}
          {hint && <p className="min-w-0 text-caption text-ink-3">{hint}</p>}
        </div>
      )}
      {spark && spark.length > 1 && <Sparkline values={spark} slot={slot} className="-mx-1 mt-4 block h-10 w-[calc(100%+0.5rem)]" />}
    </>
  );
  const cls = cn("ad-card group block min-w-0 p-4 sm:p-5", className);
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
