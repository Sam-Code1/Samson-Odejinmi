"use client";

import { useEffect, useRef, useState } from "react";
import { fmt, niceTicks, type ValueFormat } from "./format";

export type TrendPoint = { label: string; full: string; value: number; prev?: number };

/**
 * Change over time, one series (plus an optional "previous period" ghost line for comparison).
 *   area:    2px line over a soft wash, crosshair + tooltip that snaps to the nearest point.
 *   columns: rounded-top bars (max 24px, 2px apart) growing from one baseline, a tooltip per bar.
 * Measured to its container so text stays crisp at every width. Keyboard: focus the chart, then ← →.
 * A "View as table" disclosure carries every value without hovering.
 */
export function TrendChart({ points, kind = "area", format = "number", slot = 1, height = 240, label, prevLabel = "Previous period" }: {
  points: TrendPoint[]; kind?: "area" | "columns"; format?: ValueFormat; slot?: 1 | 2 | 3 | 4; height?: number; label: string; prevLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasPrev = points.some((p) => p.prev !== undefined);
  const max = Math.max(0, ...points.map((p) => Math.max(p.value, p.prev ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const L = 6, R = 6, T = 10, B = 24;
  const tickW = Math.max(...ticks.map((t) => fmt(t, format, true).length)) * 6.4 + 10;
  const x0 = L + tickW, x1 = w - R, plotW = x1 - x0, plotH = height - T - B;
  const n = points.length;
  const band = plotW / Math.max(n, 1);
  const cx = (i: number) => (kind === "columns" ? x0 + band * i + band / 2 : x0 + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2));
  const cy = (v: number) => T + plotH - (v / top) * plotH;
  const color = `var(--c${slot})`;
  // Monotone cubic (Fritsch–Carlson): a smooth curve that never overshoots the data (no dips below zero).
  const path = (vals: number[]) => {
    const P = vals.map((v, i) => [cx(i), cy(v)] as const);
    if (P.length < 3) return P.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
    const d = P.slice(1).map(([x, y], i) => (y - P[i][1]) / (x - P[i][0]));
    const m = P.map((_, i) => (i === 0 ? d[0] : i === P.length - 1 ? d[i - 1] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
    for (let i = 0; i < d.length; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    let out = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
    for (let i = 0; i < P.length - 1; i++) {
      const dx = (P[i + 1][0] - P[i][0]) / 3;
      out += `C${(P[i][0] + dx).toFixed(1)},${(P[i][1] + m[i] * dx).toFixed(1)} ${(P[i + 1][0] - dx).toFixed(1)},${(P[i + 1][1] - m[i + 1] * dx).toFixed(1)} ${P[i + 1][0].toFixed(1)},${P[i + 1][1].toFixed(1)}`;
    }
    return out;
  };
  const line = path(points.map((p) => p.value));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 78))));
  const barW = Math.min(24, Math.max(3, band - 2));
  const total = points.reduce((s, p) => s + p.value, 0);

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !n) return;
    const px = clientX - r.left;
    const i = kind === "columns" ? Math.floor((px - x0) / band) : Math.round(((px - x0) / plotW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const a = active !== null ? points[active] : null;
  const tipLeft = active !== null ? Math.min(Math.max(cx(active) - 80, 4), w - 168) : 0;

  return (
    <figure className="min-w-0">
      <div ref={box} className="ad-chart relative select-none" style={{ height }}
        tabIndex={0} role="img" aria-label={`${label}. ${n} points, total ${fmt(total, format)}. Focus and use the arrow keys to read each value.`}
        onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setActive((i) => Math.min(n - 1, (i ?? -1) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setActive((i) => Math.max(0, (i ?? n) - 1)); }
          if (e.key === "Escape") setActive(null);
        }}>
        {/* Scales to fit until measured (first paint), then redraws crisply at the real width. */}
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`wash-${slot}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.16" /><stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x0} x2={x1} y1={cy(t)} y2={cy(t)} stroke="var(--c-grid)" strokeWidth="1" />
              <text x={x0 - 8} y={cy(t) + 3.5} textAnchor="end">{fmt(t, format, true)}</text>
            </g>
          ))}
          {points.map((p, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every * 0.6) ? (
            <text key={p.full} x={cx(i)} y={height - 6} textAnchor={i === 0 && kind === "area" ? "start" : i === n - 1 && kind === "area" ? "end" : "middle"}>{p.label}</text>
          ) : null)}

          {kind === "area" ? (
            <>
              {hasPrev && <path d={path(points.map((p) => p.prev ?? 0))} fill="none" stroke="var(--c-prev)" strokeWidth="1.5" strokeLinejoin="round" />}
              <path className="ad-fade" d={`${line}L${cx(n - 1)},${cy(0)}L${cx(0)},${cy(0)}Z`} fill={`url(#wash-${slot})`} />
              <path className="ad-draw" style={{ ["--len" as string]: 4000 }} d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {n > 0 && <circle cx={cx(n - 1)} cy={cy(points[n - 1].value)} r="4" fill={color} stroke="rgb(var(--elevated))" strokeWidth="2" />}
              {a && active !== null && (
                <>
                  <line x1={cx(active)} x2={cx(active)} y1={T} y2={T + plotH} stroke="var(--c-axis)" strokeWidth="1" opacity="0.5" />
                  {hasPrev && <circle cx={cx(active)} cy={cy(a.prev ?? 0)} r="3.5" fill="var(--c-prev)" stroke="rgb(var(--elevated))" strokeWidth="2" />}
                  <circle cx={cx(active)} cy={cy(a.value)} r="5" fill={color} stroke="rgb(var(--elevated))" strokeWidth="2" />
                </>
              )}
            </>
          ) : (
            points.map((p, i) => {
              const h = Math.max(p.value > 0 ? 2 : 0, cy(0) - cy(p.value));
              const x = cx(i) - barW / 2, y = cy(0) - h, r = Math.min(4, barW / 2, h);
              return (
                <path key={p.full} className="ad-bar ad-grow" data-active={active === i ? "" : undefined} style={{ animationDelay: `${Math.min(i, 30) * 14}ms` }} fill={color}
                  d={h <= 0 ? "" : `M${x},${cy(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${cy(0)}Z`} />
              );
            })
          )}
          <line x1={x0} x2={x1} y1={cy(0)} y2={cy(0)} stroke="var(--c-axis)" strokeWidth="1" opacity="0.35" />
        </svg>

        {a && (
          <div className="ad-tip" style={{ left: tipLeft, top: 4 }}>
            <p className="text-[0.7rem] text-ink-3">{a.full}</p>
            <p className="mt-0.5 flex items-center gap-2"><span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} /><span className="ad-num font-semibold text-ink">{fmt(a.value, format)}</span></p>
            {hasPrev && <p className="mt-0.5 flex items-center gap-2 text-ink-2"><span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: "var(--c-prev)" }} /><span className="ad-num">{fmt(a.prev ?? 0, format)}</span><span className="text-[0.7rem] text-ink-3">{prevLabel.toLowerCase()}</span></p>}
          </div>
        )}
      </div>
      {hasPrev && (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-caption text-ink-3">
          <span className="inline-flex items-center gap-2"><span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: color }} />{label}</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: "var(--c-prev)" }} />{prevLabel}</span>
        </figcaption>
      )}
      <details className="mt-2 text-caption text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink">View as table</summary>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
          <table className="w-full text-left text-caption">
            <thead className="sticky top-0 bg-elevated"><tr><th className="px-3 py-1.5 font-semibold">Period</th><th className="px-3 py-1.5 text-right font-semibold">{label}</th>{hasPrev && <th className="px-3 py-1.5 text-right font-semibold">{prevLabel}</th>}</tr></thead>
            <tbody>{points.map((p) => <tr key={p.full} className="border-t border-line"><td className="px-3 py-1">{p.full}</td><td className="ad-num px-3 py-1 text-right text-ink">{fmt(p.value, format)}</td>{hasPrev && <td className="ad-num px-3 py-1 text-right">{fmt(p.prev ?? 0, format)}</td>}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
