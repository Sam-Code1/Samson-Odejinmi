/**
 * A 12-ish point trend for a stat card: a 2px line and a faint wash below it, stretched to the card. Decorative
 * (aria-hidden): the card states the number and its change in text.
 */
export function Sparkline({ values, slot = 1, className }: { values: number[]; slot?: 1 | 2 | 3 | 4; className?: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 36, P = 3;
  const max = Math.max(...values), min = Math.min(0, ...values), span = max - min || 1;
  const x = (i: number) => P + (i / (values.length - 1)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - min) / span) * (H - P * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const color = `var(--c${slot})`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={`${d}L${x(values.length - 1)},${H}L${x(0)},${H}Z`} fill={color} opacity="0.1" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
