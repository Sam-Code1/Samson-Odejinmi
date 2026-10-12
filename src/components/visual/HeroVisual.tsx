import { useId } from "react";

/**
 * Signature hero scene: dark architectural forms lit from the right with a
 * blue→violet light, a faint reflected floor and controlled grain.
 * Pure SVG driven by theme tokens, so it re-lights in light, dark and system.
 */
type BlockProps = { x: number; y: number; w: number; h: number; d: number; lit: string; slits?: boolean };

function Block({ x, y, w, h, d, lit, slits }: BlockProps) {
  const ox = d * 0.62;
  const oy = d * 0.38;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} className="art-left" />
      <polygon points={`${x + w},${y} ${x + w + ox},${y - oy} ${x + w + ox},${y + h - oy} ${x + w},${y + h}`} className="art-right" />
      <polygon points={`${x + w},${y} ${x + w + ox},${y - oy} ${x + w + ox},${y + h - oy} ${x + w},${y + h}`} fill={`url(#${lit})`} />
      <polygon points={`${x},${y} ${x + ox},${y - oy} ${x + w + ox},${y - oy} ${x + w},${y}`} className="art-top" />
      {slits &&
        [0.2, 0.42, 0.64].map((t) => (
          <rect key={t} x={x + w * t} y={y + 28} width={3} height={h - 80} fill={`url(#${lit})`} opacity={0.9} />
        ))}
    </g>
  );
}

export function HeroVisual({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const lit = `lit-${id}`;
  const glow = `glow-${id}`;
  const beam = `beam-${id}`;
  const fade = `fade-${id}`;
  const grain = `grain-${id}`;
  const floor = 720;

  return (
    <svg viewBox="0 0 1200 900" role="img" aria-label="Abstract architectural forms lit by a soft blue and violet light" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={lit} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.95 }} />
          <stop offset="0.55" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0.05 }} />
        </linearGradient>
        <radialGradient id={glow} cx="0.82" cy="0.22" r="0.65">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.9 }} />
          <stop offset="0.45" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={beam} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.5 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`m-${id}`}>
          <rect x="0" y={floor} width="1200" height={180} fill={`url(#${fade})`} />
        </mask>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* atmosphere */}
      <rect width="1200" height="900" fill={`url(#${glow})`} style={{ opacity: "var(--art-glow)" }} />

      {/* light beam passing between the forms */}
      <polygon points={`1010,70 1120,70 560,${floor} 330,${floor}`} fill={`url(#${beam})`} opacity="0.18" />

      {/* floor lines converging to a vanishing point */}
      <g className="art-floor" strokeWidth="1" opacity="0.14">
        {Array.from({ length: 13 }).map((_, i) => {
          const x = -300 + i * 150;
          return <line key={i} x1={600 + (x - 600) * 0.12} y1={floor} x2={x} y2={900} />;
        })}
        {[0, 1, 2, 3].map((i) => (
          <line key={`h${i}`} x1="0" x2="1200" y1={floor + 8 + i * i * 14 + i * 10} y2={floor + 8 + i * i * 14 + i * 10} />
        ))}
      </g>
      <line x1="0" y1={floor} x2="1200" y2={floor} className="art-floor" strokeWidth="1" opacity="0.3" />

      {/* reflections */}
      <g mask={`url(#m-${id})`} opacity="0.5" transform={`translate(0 ${floor * 2}) scale(1 -1)`}>
        <Block x={380} y={210} w={210} h={510} d={130} lit={lit} />
        <Block x={660} y={400} w={150} h={320} d={90} lit={lit} />
      </g>

      {/* forms, back to front */}
      <Block x={150} y={330} w={170} h={390} d={110} lit={lit} />
      <Block x={380} y={210} w={210} h={510} d={130} lit={lit} slits />
      <Block x={660} y={400} w={150} h={320} d={90} lit={lit} />
      <Block x={880} y={470} w={130} h={250} d={80} lit={lit} />
      <Block x={500} y={650} w={90} h={70} d={60} lit={lit} />

      {/* the thread: a single line of light crossing the scene */}
      <path d="M-20 790 C 300 700, 640 560, 1220 300" fill="none" strokeWidth="1.5" style={{ stroke: `rgb(var(--violet-soft))`, opacity: 0.55 }} />
      <path d="M-20 790 C 300 700, 640 560, 1220 300" fill="none" strokeWidth="0.75" style={{ stroke: `rgb(var(--blue-soft))`, opacity: 0.8 }} transform="translate(0 -6)" />

      {/* grain */}
      <rect width="1200" height="900" filter={`url(#${grain})`} style={{ opacity: "var(--grain)", mixBlendMode: "overlay" }} />
    </svg>
  );
}
