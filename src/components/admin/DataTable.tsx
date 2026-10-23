import { cn } from "@/lib/utils";
import { AdminEmpty } from "./AdminStates";

export type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; className?: string; hideOnMobile?: boolean; primary?: boolean };

/**
 * Desktop: a real table in a card, header on a quiet band, long cell text wrapping (never pushing the table wider than
 * the screen). Mobile: each row becomes a labelled card, so nothing needs sideways scrolling.
 */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty: { title: string; body?: string; action?: { href: string; label: string } } }) {
  if (rows.length === 0) return <AdminEmpty {...empty} />;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="ad-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto" data-scroll>
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60">
                {columns.map((c) => <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-ink-3 first:pl-5 last:pr-5", c.className)}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={rowKey(r)} className="border-b border-line transition-colors last:border-0 hover:bg-surface/50">
                  {columns.map((c) => <td key={c.key} className={cn("px-4 py-3.5 align-middle first:pl-5 last:pr-5", c === primary ? "min-w-[12rem] max-w-[28rem]" : "max-w-[22rem]", c.className)}>{c.cell(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="ad-card min-w-0 p-4">
            <div className="min-w-0 text-label">{primary.cell(r)}</div>
            <dl className="mt-3 space-y-2 border-t border-line pt-3">
              {columns.filter((c) => c !== primary && !c.hideOnMobile).map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-4 text-body-sm">
                  <dt className="shrink-0 text-ink-3">{c.header}</dt>
                  <dd className="min-w-0 text-right">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
