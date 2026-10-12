import { useId } from "react";

/** Abstract 3D workspace: an iso grid, one object, a camera and a light, labelled Learn / Build / Create. */
export function AcademyVisual({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const lit = `al-${id}`;
  const glow = `ag-${id}`;
  const mask = `am-${id}`;
  const dx = 95, dy = 55, s = 110;
  const C = { x: 600, y: 545 };
  const u = { x: dx, y: dy };
  const v = { x: -dx, y: dy };

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let k = -3.5; k <= 3.5; k += 1) {
    lines.push({ x1: C.x + k * v.x - 4 * u.x, y1: C.y + k * v.y - 4 * u.y, x2: C.x + k * v.x + 4 * u.x, y2: C.y + k * v.y + 4 * u.y });
    lines.push({ x1: C.x + k * u.x - 4 * v.x, y1: C.y + k * u.y - 4 * v.y, x2: C.x + k * u.x + 4 * v.x, y2: C.y + k * u.y + 4 * v.y });
  }
  const T = { x: 600, y: 380 };
  const top = `${T.x},${T.y} ${T.x + dx},${T.y + dy} ${T.x},${T.y + 2 * dy} ${T.x - dx},${T.y + dy}`;
  const left = `${T.x - dx},${T.y + dy} ${T.x},${T.y + 2 * dy} ${T.x},${T.y + 2 * dy + s} ${T.x - dx},${T.y + dy + s}`;
  const right = `${T.x},${T.y + 2 * dy} ${T.x + dx},${T.y + dy} ${T.x + dx},${T.y + dy + s} ${T.x},${T.y + 2 * dy + s}`;

  return (
    <svg viewBox="0 0 1200 900" role="img" aria-label="A simple 3D workspace with a grid, an object, a camera and a light" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={lit} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.9 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0.15 }} />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.8 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0 }} />
        </radialGradient>
        <radialGradient id={mask + "g"} cx="0.5" cy="0.62" r="0.5">
          <stop offset="0.35" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={mask}>
          <rect width="1200" height="900" fill={`url(#${mask}g)`} />
        </mask>
      </defs>

      <circle cx="900" cy="230" r="260" fill={`url(#${glow})`} style={{ opacity: "var(--art-glow)" }} />

      <g mask={`url(#${mask})`} className="art-floor" strokeWidth="1" opacity="0.4">
        {lines.map((l, i) => <line key={i} {...l} />)}
      </g>

      <polygon points={left} className="art-left" />
      <polygon points={right} className="art-right" />
      <polygon points={right} fill={`url(#${lit})`} />
      <polygon points={top} className="art-top" />

      {/* light */}
      <g strokeWidth="1.5" className="art-ink">
        <circle cx="900" cy="230" r="16" style={{ fill: "rgb(var(--blue-soft))", stroke: "none" }} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1={900 + Math.cos((a * Math.PI) / 180) * 28} y1={230 + Math.sin((a * Math.PI) / 180) * 28} x2={900 + Math.cos((a * Math.PI) / 180) * 40} y2={230 + Math.sin((a * Math.PI) / 180) * 40} />
        ))}
        <line x1="885" y1="248" x2="700" y2="420" strokeDasharray="3 6" style={{ stroke: "rgb(var(--blue-soft))", opacity: 0.7 }} />
      </g>

      {/* camera */}
      <g strokeWidth="1.5" className="art-ink">
        <rect x="170" y="400" width="86" height="56" rx="4" />
        <path d="M256 418 L292 400 V456 L256 438 Z" />
        <circle cx="198" cy="388" r="14" />
        <circle cx="228" cy="388" r="14" />
        <line x1="292" y1="428" x2="510" y2="500" strokeDasharray="3 6" style={{ stroke: "rgb(var(--violet-soft))", opacity: 0.7 }} />
      </g>

      {/* labels */}
      <g className="art-label">
        <text x="900" y="300" textAnchor="middle">Create</text>
        <text x="213" y="494" textAnchor="middle">Learn</text>
        <text x="600" y="700" textAnchor="middle">Build</text>
      </g>
    </svg>
  );
}
