/** Formats chart values on server and client alike. "money:NGN" values are minor units (kobo, cents). */
export type ValueFormat = "number" | "percent" | `money:${string}`;

const SYMBOL: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };

export function fmt(v: number, f: ValueFormat = "number", compact = false): string {
  if (f === "percent") return `${Math.round(v * 10) / 10}%`;
  if (f.startsWith("money:")) {
    const cur = f.slice(6), major = v / 100, sym = SYMBOL[cur] ?? `${cur} `;
    if (compact && Math.abs(major) >= 1000) return sym + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(major);
    return sym + new Intl.NumberFormat("en", { maximumFractionDigits: major % 1 ? 2 : 0 }).format(major);
  }
  if (compact && Math.abs(v) >= 1000) return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  return new Intl.NumberFormat("en").format(Math.round(v * 100) / 100);
}

/** Up to 5 clean axis ticks from 0 (1/2/2.5/5 × 10ⁿ steps). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Percentage change vs the previous period, or null when there's nothing to compare against. */
export function change(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}
