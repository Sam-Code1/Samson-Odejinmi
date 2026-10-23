import { fmt } from "./format";

/**
 * A conversion funnel: each stage as a bar sized against the first, with the step-to-step rate between them.
 * Stages share one hue (an ordered magnitude, not separate categories).
 */
export function Funnel({ stages, slot = 1 }: { stages: { label: string; value: number }[]; slot?: 1 | 2 | 3 | 4 }) {
  const first = stages[0]?.value || 0;
  return (
    <ol className="space-y-2">
      {stages.map((s, i) => {
        const pct = first ? (s.value / first) * 100 : 0;
        const step = i > 0 && stages[i - 1].value ? (s.value / stages[i - 1].value) * 100 : null;
        return (
          <li key={s.label}>
            {step !== null && <p className="mb-1 ml-1 text-caption text-ink-3">↓ {fmt(step, "percent")} continue</p>}
            <div className="flex items-center gap-3">
              <div className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-lg bg-surface">
                <div className="absolute inset-y-0 left-0 rounded-lg transition-[width] duration-700 ease-out" style={{ width: `${Math.max(first ? 1.5 : 0, pct)}%`, background: `var(--c${slot})`, opacity: 1 - i * 0.14 }} />
                <span className="relative flex h-full items-center px-3 text-body-sm font-medium text-ink mix-blend-normal">
                  <span className="truncate rounded bg-elevated/85 px-1.5">{s.label}</span>
                </span>
              </div>
              <span className="ad-num w-16 shrink-0 text-right text-body-sm font-semibold">{fmt(s.value, "number", true)}</span>
              <span className="ad-num w-12 shrink-0 text-right text-caption text-ink-3">{i === 0 ? "100%" : fmt(pct, "percent")}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
