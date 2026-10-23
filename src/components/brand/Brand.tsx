import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Fola Academy brand primitives (Brand Guidelines §05, §10, §13). Pure SVG, colour from CSS variables, so they follow
 * Night/Paper automatically.
 */

/**
 * The constructed F on its 48-unit grid: stem 10×36 (structure), arm 28×10 (the craft), node r5 centred at 31/27 (the
 * idea), connector 6×2 path-start → path-end (understanding). Never redrawn, recoloured or separated.
 * `small` = the ≤24px version: no connector, heavier parts.
 */
export function FMark({ className, small = false, title }: { className?: string; small?: boolean; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`fa-path-${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgb(var(--path-start, 91 123 255))" />
          <stop offset="1" stopColor="rgb(var(--path-end, 139 114 255))" />
        </linearGradient>
      </defs>
      {small ? (
        <>
          <rect x="6" y="5" width="12" height="38" fill="rgb(var(--ink))" />
          <rect x="6" y="5" width="30" height="12" fill="rgb(var(--ink))" />
          <circle cx="30" cy="28" r="6.5" fill="rgb(var(--node, 139 114 255))" />
        </>
      ) : (
        <>
          <rect x="8" y="6" width="10" height="36" fill="rgb(var(--ink))" />
          <rect x="8" y="6" width="28" height="10" fill="rgb(var(--ink))" />
          <rect x="19" y="26" width="7" height="2" fill={`url(#fa-path-${id})`} />
          <circle cx="31" cy="27" r="5" fill="rgb(var(--node, 139 114 255))" />
        </>
      )}
    </svg>
  );
}

/** Horizontal lockup (website header): symbol + "Fola" 800 + "Academy" 500. */
export function FolaLogo({ className, descriptor = false }: { className?: string; descriptor?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <FMark className="h-7 w-7" />
      <span className="flex flex-col whitespace-nowrap leading-none">
        <span className="text-[1.0625rem] tracking-[-0.01em]"><span className="font-extrabold">Fola</span> <span className="font-medium">Academy</span></span>
        {descriptor && <span className="fa-label mt-1 !text-[0.55rem]">Creative &amp; technical education</span>}
      </span>
    </span>
  );
}

/**
 * The Pathway: ○ idea → — understanding → □ creation. The brand's signature and its only gradient.
 * `value` (0–1) turns it into a progress bar: the line fills from the circle, the node travels with it, and completion
 * snaps the square solid (§13).
 */
export function Pathway({ value, className, label }: { value?: number; className?: string; label?: string }) {
  const v = value === undefined ? 1 : Math.max(0, Math.min(1, value));
  const progress = value !== undefined;
  const done = progress && v >= 1;
  return (
    <div className={cn("relative flex h-3 items-center", className)} {...(progress ? { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v * 100), "aria-label": label ?? "Progress" } : { "aria-hidden": true })}>
      <span className="absolute left-0 h-3 w-3 rounded-full border-[1.5px] border-[rgb(var(--path-start))] bg-canvas" />
      <span className="absolute left-3 right-3 h-px bg-line" />
      <span className="fa-draw absolute left-3 h-[2px] rounded-full" style={{ right: `calc(0.75rem + (100% - 1.5rem) * ${1 - v})`, background: "linear-gradient(90deg, rgb(var(--path-start)), rgb(var(--path-end)))" }} />
      {progress && !done && v > 0 && <span className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-node shadow-[0_0_0_3px_rgb(var(--canvas))]" style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${v})` }} />}
      <span className={cn("absolute right-0 h-2.5 w-2.5", done || !progress ? "bg-[rgb(var(--path-end))]" : "border-[1.5px] border-line-strong bg-canvas")} />
    </div>
  );
}

/** Thin progress bar with the travelling node (cards, compact places). */
export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative h-1 rounded-full bg-line", className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v * 100}%`, background: "linear-gradient(90deg, rgb(var(--path-start)), rgb(var(--path-end)))" }} />
      {v > 0 && v < 1 && <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-node" style={{ left: `${v * 100}%` }} />}
    </div>
  );
}

/** Technical mono label, e.g. "MODULE 02 — GEOMETRY". */
export function Label({ children, className, as: As = "p" }: { children: React.ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" | "div" }) {
  return <As className={cn("fa-label", className)}>{children}</As>;
}

/** Callout card: "Why this works" / "Note" / "Watch out" / "Key term" / "Exercise". */
export function Callout({ label, tone = "idea", children, className }: { label: string; tone?: "idea" | "warn"; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("fa-callout", className)}>
      <p className={cn("fa-label flex items-center gap-2", tone === "warn" ? "!text-caution" : "!text-blue")}>
        <span aria-hidden className={cn("h-1.5 w-1.5", tone === "warn" ? "bg-caution" : "rounded-full bg-node")} />{label}
      </p>
      <div className="mt-2 text-body text-ink">{children}</div>
    </div>
  );
}

/**
 * Isometric constructed F (the brand's 3D hero object, §11) drawn in SVG: paper/stone blocks, navy plinth, a violet
 * "idea" sphere joined by the blue connector. One key light from the upper left. An illustration, not the logo.
 */
export function IsoF({ className, title = "The constructed F" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 400 360" className={className} role="img" aria-label={title}>
      <defs>
        <radialGradient id={`s-${id}`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#B7A2FF" />
          <stop offset="0.45" stopColor="#8B72FF" />
          <stop offset="1" stopColor="#5A3BD1" />
        </radialGradient>
        <linearGradient id={`c-${id}`} x1="0" x2="1"><stop offset="0" stopColor="#5B7BFF" /><stop offset="1" stopColor="#8B72FF" /></linearGradient>
      </defs>
      {/* plinth */}
      <polygon points="200,330 30,232 200,134 370,232" fill="#10162B" stroke="#2A3358" strokeWidth="1" />
      {/* stem: front, side, top */}
      <polygon points="96,284 96,92 146,63 146,255" fill="#F4F1EA" />
      <polygon points="146,255 146,63 172,78 172,270" fill="#CFCABD" />
      {/* arm */}
      <polygon points="96,92 186,40 290,100 200,152 146,121 146,63" fill="#E6E2D8" />
      <polygon points="96,92 146,63 146,121 96,150" fill="#F4F1EA" />
      <polygon points="146,121 200,152 200,178 146,147" fill="#CFCABD" />
      <polygon points="200,152 290,100 290,126 200,178" fill="#DDD8CB" />
      {/* connector + idea */}
      <line x1="172" y1="196" x2="232" y2="226" stroke={`url(#c-${id})`} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="262" cy="262" rx="34" ry="12" fill="#080B16" opacity="0.55" />
      <circle cx="252" cy="226" r="34" fill={`url(#s-${id})`} />
      <circle cx="240" cy="214" r="9" fill="#FFFFFF" opacity="0.28" />
    </svg>
  );
}
