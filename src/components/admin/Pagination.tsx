import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pageSize, total, params }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return total > 0 ? <p className="mt-4 text-caption text-ink-3">{total} {total === 1 ? "result" : "results"}</p> : null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };
  const btn = "inline-flex h-9 items-center gap-1 rounded border border-line-strong px-3 text-label transition-colors hover:border-ink";
  const off = "pointer-events-none opacity-40";
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
      <p className="text-caption text-ink-3">Page {page} of {pages} · {total} results</p>
      <div className="flex gap-2">
        <Link href={href(page - 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={`${btn} ${page <= 1 ? off : ""}`}><ChevronLeft aria-hidden className="h-4 w-4" />Previous</Link>
        <Link href={href(page + 1)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined} className={`${btn} ${page >= pages ? off : ""}`}>Next<ChevronRight aria-hidden className="h-4 w-4" /></Link>
      </div>
    </nav>
  );
}
