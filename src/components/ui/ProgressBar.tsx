export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label ?? "Progress"} className="h-1 w-full overflow-hidden rounded-full bg-line">
      <div className="thread-solid h-full rounded-full transition-[width] duration-slow ease-quiet" style={{ width: `${v}%` }} />
    </div>
  );
}
