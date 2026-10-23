import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { change } from "./format";

/**
 * Change vs the previous period, as text with an arrow (never colour alone). `goodWhenDown` for metrics like refunds.
 * Shows "new" when the previous period was zero.
 */
export function Delta({ cur, prev, goodWhenDown = false, className }: { cur: number; prev: number; goodWhenDown?: boolean; className?: string }) {
  const c = change(cur, prev);
  if (c === null) return <span className={cn("inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[0.72rem] font-semibold text-ink-2", className)}>New</span>;
  const flat = Math.abs(c) < 0.5;
  const good = flat ? null : (c > 0) !== goodWhenDown;
  const Icon = flat ? Minus : c > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("ad-num inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold",
      good === null ? "bg-surface text-ink-2" : good ? "bg-success/10 text-success" : "bg-warm/10 text-warm", className)}
      title="Compared with the previous period of the same length">
      <Icon aria-hidden className="h-3.5 w-3.5" />{flat ? "0%" : `${c > 0 ? "+" : ""}${Math.abs(c) >= 100 ? Math.round(c) : c.toFixed(1)}%`}
      <span className="sr-only"> compared with the previous period</span>
    </span>
  );
}
