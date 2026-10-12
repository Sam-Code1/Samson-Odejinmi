import { cn } from "@/lib/utils";
import { AdminEmpty } from "./AdminStates";

export type Column<T> = { key: string; header: string; cell: (row: T) => React.ReactNode; className?: string; hideOnMobile?: boolean; primary?: boolean };

/** Desktop: a real table. Mobile: each row becomes a labelled card, so nothing needs sideways scrolling. */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty: { title: string; body?: string; action?: { href: string; label: string } } }) {
  if (rows.length === 0) return <AdminEmpty {...empty} />;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-elevated md:block">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-caption font-semibold text-ink-3", c.className)}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line last:border-0 hover:bg-surface/50">
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-line bg-elevated p-4">
            <div className="text-label">{primary.cell(r)}</div>
            <dl className="mt-3 space-y-2">
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
