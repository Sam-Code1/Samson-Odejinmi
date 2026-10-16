"use client";

import * as React from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

/**
 * Block breaker. The bricks are little 3D cubes (top, front and side faces) spelling the CMS text in a 5×5 block font,
 * shaded along the brand's blue → violet thread.
 *
 * Controls: mouse or finger moves the paddle; ←/→ (or A/D) when the game has focus; Space/Enter to launch or pause.
 * The loop runs only while playing, and pauses itself when the tab is hidden or the game scrolls out of view.
 * The canvas is decorative for assistive tech; state is announced through a live region and real buttons.
 */

const FONT: Record<string, string> = {
  A: ".###." + "#...#" + "#####" + "#...#" + "#...#", B: "####.#...#####.#...#####.", C: ".#####....#....#.....####", D: "####.#...##...##...#####.",
  E: "######....####.#....#####", F: "######....####.#....#....", G: ".#####....#..###...#.###.", H: "#...##...#######...##...#",
  I: "#####..#....#....#..#####", J: "..###...#....#.#..#..##..", K: "#...##..#.###..#..#.#...#", L: "#....#....#....#....#####",
  M: "#...###.###.#.##...##...#", N: "#...###..##.#.##..###...#", O: ".###.#...##...##...#.###.", P: "####.#...#####.#....#....",
  Q: ".###.#...##.#.##..#..##.#", R: "####.#...#####.#..#.#...#", S: ".#####.....###.....#####.", T: "#####..#....#....#....#..",
  U: "#...##...##...##...#.###.", V: "#...##...##...#.#.#...#..", W: "#...##...##.#.###.###...#", X: "#...#.#.#...#...#.#.#...#",
  Y: "#...#.#.#...#....#....#..", Z: "#####...#...#...#...#####", "0": ".###.#..###.#.###..#.###.", "1": "..#...##....#....#...###.",
  "2": "####.....#.###.#....#####", "3": "####.....#.###.....#####.", "4": "#..#.#..#.#####...#....#.", "5": "######....####.....#####.",
  "6": ".###.#....####.#...#.###.", "7": "#####...#...#...#....#...", "8": ".###.#...#.###.#...#.###.", "9": ".###.#...#.####....#.###.",
  " ": ".........................", "!": "..#....#....#.........#..", "?": ".###." + "#...#" + "..##." + "....." + "..#..", ".": "......................#..",
  "-": "..........###............",
};

type Phase = "ready" | "serve" | "playing" | "paused" | "won" | "lost";
type Rgb = [number, number, number];

const LIVES = 3;

function rgbVar(el: Element, name: string, fallback: Rgb): Rgb {
  const v = getComputedStyle(el).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return v.length === 3 && v.every((n) => Number.isFinite(n)) ? (v as Rgb) : fallback;
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
const css = (c: Rgb, a = 1) => `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`;

/** Brick grid from the text: each line centred, 1 empty column between letters, 2 empty rows between lines. */
function buildGrid(lines: string[]) {
  const widest = Math.max(...lines.map((l) => l.length));
  const cols = widest * 6 - 1;
  const rows = lines.length * 5 + (lines.length - 1) * 2;
  const cells: boolean[] = new Array(cols * rows).fill(false);
  lines.forEach((line, li) => {
    const offset = Math.floor((cols - (line.length * 6 - 1)) / 2);
    [...line].forEach((ch, ci) => {
      const g = FONT[ch] ?? FONT[" "];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        if (g[r * 5 + c] === "#") cells[(li * 7 + r) * cols + offset + ci * 6 + c] = true;
      }
    });
  });
  return { cols, rows, cells };
}

export function BlockBreaker({ lines }: { lines: string[] }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [lives, setLives] = React.useState(LIVES);
  const [left, setLeft] = React.useState(0);
  const [announce, setAnnounce] = React.useState("");

  const grid = React.useMemo(() => buildGrid(lines), [lines]);
  const total = React.useMemo(() => grid.cells.filter(Boolean).length, [grid]);

  // Mutable game state lives in a ref so the animation loop never re-renders React.
  const g = React.useRef({
    w: 0, h: 0, cell: 0, ox: 0, oy: 0,
    alive: [] as boolean[], left: 0,
    px: 0, pTarget: 0, pw: 0, ph: 0, py: 0,
    bx: 0, by: 0, vx: 0, vy: 0, r: 0, speed: 0,
    keys: { left: false, right: false },
    phase: "ready" as Phase, lives: LIVES,
    colors: { ink: [245, 247, 255] as Rgb, ink3: [122, 131, 156] as Rgb, blue: [77, 141, 255] as Rgb, violet: [139, 92, 246] as Rgb },
  });

  const setGamePhase = React.useCallback((p: Phase) => { g.current.phase = p; setPhase(p); }, []);

  // ───────────── layout ─────────────
  const layout = React.useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const s = g.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scaleX = w / s.w || 1;
    s.w = w; s.h = h;
    s.cell = Math.floor(Math.min((w * 0.88) / grid.cols, (h * 0.44) / grid.rows));
    s.ox = Math.round((w - s.cell * grid.cols) / 2);
    s.oy = Math.round(h * 0.1);
    s.pw = Math.max(64, Math.min(150, w * 0.17));
    s.ph = Math.max(6, Math.round(s.cell * 0.55));
    s.py = h - Math.max(26, h * 0.08);
    s.r = Math.max(4, Math.round(s.cell * 0.42));
    s.speed = Math.max(w, h) * 0.6;
    if (scaleX !== 1 && s.px) { s.px *= scaleX; s.pTarget *= scaleX; s.bx *= scaleX; }
    if (!s.px) { s.px = s.pTarget = w / 2; }
    const c = wrap;
    s.colors = {
      ink: rgbVar(c, "--ink", s.colors.ink), ink3: rgbVar(c, "--ink-3", s.colors.ink3),
      blue: rgbVar(c, "--blue", s.colors.blue), violet: rgbVar(c, "--violet", s.colors.violet),
    };
  }, [grid]);

  // ───────────── drawing ─────────────
  const draw = React.useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const s = g.current, { cell, ox, oy } = s, { ink, ink3, blue, violet } = s.colors;
    ctx.clearRect(0, 0, s.w, s.h);

    const gap = Math.max(1, Math.round(cell * 0.12));
    const d = Math.max(1, Math.round(cell * 0.26));
    const face = cell - gap - d;
    for (let i = 0; i < s.alive.length; i++) {
      if (!s.alive[i]) continue;
      const col = i % grid.cols, row = Math.floor(i / grid.cols);
      const x = ox + col * cell, y = oy + row * cell;
      const base = mix(blue, violet, grid.cols > 1 ? col / (grid.cols - 1) : 0);
      // top
      ctx.fillStyle = css(mix(base, [255, 255, 255], 0.45));
      ctx.beginPath(); ctx.moveTo(x, y + d); ctx.lineTo(x + d, y); ctx.lineTo(x + d + face, y); ctx.lineTo(x + face, y + d); ctx.closePath(); ctx.fill();
      // side
      ctx.fillStyle = css(mix(base, [0, 0, 0], 0.38));
      ctx.beginPath(); ctx.moveTo(x + face, y + d); ctx.lineTo(x + d + face, y); ctx.lineTo(x + d + face, y + face); ctx.lineTo(x + face, y + d + face); ctx.closePath(); ctx.fill();
      // front
      ctx.fillStyle = css(base);
      ctx.fillRect(x, y + d, face, face);
    }

    // floor line
    ctx.fillStyle = css(ink3, 0.18);
    ctx.fillRect(0, s.py + s.ph + Math.max(8, s.h * 0.025), s.w, 1);

    // paddle
    ctx.fillStyle = css(ink);
    const pr = s.ph / 2;
    ctx.beginPath();
    ctx.moveTo(s.px - s.pw / 2 + pr, s.py);
    ctx.arcTo(s.px + s.pw / 2, s.py, s.px + s.pw / 2, s.py + s.ph, pr);
    ctx.arcTo(s.px + s.pw / 2, s.py + s.ph, s.px - s.pw / 2, s.py + s.ph, pr);
    ctx.arcTo(s.px - s.pw / 2, s.py + s.ph, s.px - s.pw / 2, s.py, pr);
    ctx.arcTo(s.px - s.pw / 2, s.py, s.px + s.pw / 2, s.py, pr);
    ctx.fill();

    // ball
    if (s.phase !== "ready" && s.phase !== "won") {
      ctx.save();
      ctx.shadowColor = css(ink, 0.7); ctx.shadowBlur = s.r * 2.5;
      ctx.fillStyle = css(ink);
      ctx.beginPath(); ctx.arc(s.bx, s.by, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, [grid]);

  // ───────────── game control ─────────────
  const resetBricks = React.useCallback(() => {
    const s = g.current;
    s.alive = [...grid.cells];
    s.left = total;
    setLeft(total);
  }, [grid, total]);

  const serve = React.useCallback(() => {
    const s = g.current;
    s.bx = s.px; s.by = s.py - s.r - 1; s.vx = 0; s.vy = 0;
    setGamePhase("serve");
  }, [setGamePhase]);

  const launch = React.useCallback(() => {
    const s = g.current;
    const a = (-Math.PI / 2) + (Math.random() * 0.6 - 0.3);
    s.vx = Math.cos(a) * s.speed; s.vy = Math.sin(a) * s.speed;
    setGamePhase("playing");
  }, [setGamePhase]);

  const start = React.useCallback(() => {
    const s = g.current;
    resetBricks();
    s.lives = LIVES; setLives(LIVES);
    serve();
    setAnnounce(`Game started. ${LIVES} lives. Press Space or tap to launch.`);
    wrapRef.current?.focus({ preventScroll: true });
  }, [resetBricks, serve]);

  const togglePause = React.useCallback(() => {
    const p = g.current.phase;
    if (p === "playing") { setGamePhase("paused"); setAnnounce("Paused."); }
    else if (p === "paused") { setGamePhase("playing"); setAnnounce("Resumed."); }
  }, [setGamePhase]);

  // first paint + resize
  React.useEffect(() => {
    resetBricks();
    layout();
    serve();
    setGamePhase("ready");
    draw();
    const ro = new ResizeObserver(() => { layout(); if (g.current.phase === "serve") { g.current.bx = g.current.px; g.current.by = g.current.py - g.current.r - 1; } draw(); });
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [layout, draw, resetBricks, serve, setGamePhase]);

  // the loop: only while serving or playing
  React.useEffect(() => {
    if (phase !== "playing" && phase !== "serve") { draw(); return; }
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const s = g.current;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      // paddle
      const kb = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0);
      if (kb) s.pTarget += kb * s.w * 1.1 * dt;
      s.pTarget = Math.max(s.pw / 2, Math.min(s.w - s.pw / 2, s.pTarget));
      s.px += (s.pTarget - s.px) * Math.min(1, dt * 18);

      if (s.phase === "serve") {
        s.bx = s.px; s.by = s.py - s.r - 1;
      } else if (s.phase === "playing") {
        const dist = Math.hypot(s.vx, s.vy) * dt;
        const n = Math.max(1, Math.ceil(dist / Math.max(2, s.r * 0.8)));
        for (let k = 0; k < n && s.phase === "playing"; k++) {
          const sx = (s.vx * dt) / n, sy = (s.vy * dt) / n;
          s.bx += sx;
          if (hitBrick(s)) { s.bx -= sx; s.vx = -s.vx; }
          s.by += sy;
          if (hitBrick(s)) { s.by -= sy; s.vy = -s.vy; }
          // walls
          if (s.bx < s.r) { s.bx = s.r; s.vx = Math.abs(s.vx); }
          if (s.bx > s.w - s.r) { s.bx = s.w - s.r; s.vx = -Math.abs(s.vx); }
          if (s.by < s.r) { s.by = s.r; s.vy = Math.abs(s.vy); }
          // paddle: the bounce angle depends on where it lands
          if (s.vy > 0 && s.by + s.r >= s.py && s.by - s.r <= s.py + s.ph && Math.abs(s.bx - s.px) <= s.pw / 2 + s.r) {
            const off = Math.max(-1, Math.min(1, (s.bx - s.px) / (s.pw / 2)));
            const sp = Math.min(s.speed * 1.5, Math.hypot(s.vx, s.vy));
            const a = -Math.PI / 2 + off * (Math.PI / 3);
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
            s.by = s.py - s.r - 0.5;
          }
          if (s.by - s.r > s.h) {
            s.lives -= 1; setLives(s.lives);
            if (s.lives <= 0) { setGamePhase("lost"); setAnnounce("Out of lives. Play again?"); }
            else { serve(); setAnnounce(`${s.lives} ${s.lives === 1 ? "life" : "lives"} left. Press Space or tap to launch.`); }
            break;
          }
          if (s.left === 0) { setGamePhase("won"); setAnnounce("Cleared. Nice work."); break; }
        }
      }
      draw();
      if (s.phase === "playing" || s.phase === "serve") raf = requestAnimationFrame(step);
    };

    function hitBrick(s: typeof g.current) {
      const { cell, ox, oy } = s;
      const c0 = Math.floor((s.bx - s.r - ox) / cell), c1 = Math.floor((s.bx + s.r - ox) / cell);
      const r0 = Math.floor((s.by - s.r - oy) / cell), r1 = Math.floor((s.by + s.r - oy) / cell);
      for (let r = r0; r <= r1; r++) {
        if (r < 0 || r >= grid.rows) continue;
        for (let c = c0; c <= c1; c++) {
          if (c < 0 || c >= grid.cols) continue;
          const i = r * grid.cols + c;
          if (s.alive[i]) {
            s.alive[i] = false;
            s.left -= 1;
            setLeft(s.left);
            // a touch faster as the word disappears
            const f = 1 + 0.5 * (1 - s.left / total);
            const sp = Math.hypot(s.vx, s.vy) || 1;
            s.vx = (s.vx / sp) * s.speed * f; s.vy = (s.vy / sp) * s.speed * f;
            return true;
          }
        }
      }
      return false;
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, draw, grid, total, serve, setGamePhase]);

  // pause when hidden or scrolled away
  React.useEffect(() => {
    const pauseIfPlaying = () => { if (g.current.phase === "playing") { setGamePhase("paused"); setAnnounce("Paused."); } };
    const onVis = () => { if (document.hidden) pauseIfPlaying(); };
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver((es) => { if (es.every((e) => !e.isIntersecting)) pauseIfPlaying(); }, { threshold: 0.15 });
    if (wrapRef.current) io.observe(wrapRef.current);
    return () => { document.removeEventListener("visibilitychange", onVis); io.disconnect(); };
  }, [setGamePhase]);

  // ───────────── input ─────────────
  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    g.current.pTarget = e.clientX - rect.left;
  };
  const onCanvasClick = () => {
    const p = g.current.phase;
    if (p === "serve") launch();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const p = g.current.phase;
    if (["ArrowLeft", "a", "A"].includes(e.key)) { g.current.keys.left = true; e.preventDefault(); }
    else if (["ArrowRight", "d", "D"].includes(e.key)) { g.current.keys.right = true; e.preventDefault(); }
    else if ((e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
      e.preventDefault();
      if (p === "serve") launch();
      else if (p === "playing" || p === "paused") togglePause();
      else start();
    } else if ((e.key === "p" || e.key === "P" || e.key === "Escape") && (p === "playing" || p === "paused")) togglePause();
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) g.current.keys.left = false;
    if (["ArrowRight", "d", "D"].includes(e.key)) g.current.keys.right = false;
  };

  const active = phase === "playing" || phase === "serve";
  const label = lines.join(" ");

  return (
    <div>
      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-roledescription="game"
        aria-label={`Block breaker: break the bricks spelling “${label}”. Arrow keys move the paddle, Space launches and pauses.`}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => { g.current.keys.left = g.current.keys.right = false; }}
        className="spot-stage relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-line sm:aspect-[16/9]"
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          onPointerMove={onPointer}
          onPointerDown={(e) => { onPointer(e); onCanvasClick(); }}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: active ? "none" : "auto", cursor: active ? "none" : "default" }}
        />

        {(phase === "ready" || phase === "won" || phase === "lost" || phase === "paused") && (
          <div className="absolute inset-x-0 bottom-[16%] flex flex-col items-center gap-3 px-5 text-center">
            {phase === "won" && <p className="text-h3 font-extrabold">Cleared. <span className="font-serif font-normal italic">It still renders.</span></p>}
            {phase === "lost" && <p className="text-h3 font-extrabold">Out of lives.</p>}
            {phase === "paused" && <p className="text-h3 font-extrabold">Paused</p>}
            <button
              type="button"
              onClick={phase === "paused" ? togglePause : start}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-6 text-label text-canvas transition-opacity hover:opacity-90"
            >
              {phase === "paused" ? <Play aria-hidden className="h-4 w-4" /> : phase === "ready" ? <Play aria-hidden className="h-4 w-4" /> : <RotateCcw aria-hidden className="h-4 w-4" />}
              {phase === "paused" ? "Resume" : phase === "ready" ? "Play" : "Play again"}
            </button>
          </div>
        )}
        {phase === "serve" && (
          <p aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[22%] text-center text-caption text-ink-3">Tap, click or press Space to launch</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-caption text-ink-3">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5" aria-label={`${lives} ${lives === 1 ? "life" : "lives"} left`}>
            {Array.from({ length: LIVES }, (_, i) => <span key={i} aria-hidden className={`h-2 w-2 rounded-full ${i < lives ? "bg-ink" : "bg-ink/20"}`} />)}
          </span>
          <span className="tabular-nums">{total - left} / {total} bricks</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">Mouse, finger or ← → · Space to launch or pause</span>
          {(phase === "playing" || phase === "paused") && (
            <button type="button" onClick={togglePause} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-strong px-4 text-label text-ink-2 hover:border-ink hover:text-ink">
              {phase === "paused" ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
              {phase === "paused" ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
