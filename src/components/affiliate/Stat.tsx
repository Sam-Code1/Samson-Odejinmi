export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-elevated p-4 sm:p-5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className="mt-2 text-h3 tabular-nums [overflow-wrap:anywhere]">{value}</p>
      {note && <p className="mt-1 text-caption text-ink-3">{note}</p>}
    </div>
  );
}
