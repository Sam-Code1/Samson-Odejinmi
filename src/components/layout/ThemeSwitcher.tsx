"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Pref = "light" | "system" | "dark";
const KEY = "theme";
const OPTIONS: { value: Pref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
];

function apply(pref: Pref) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = pref === "system" ? (dark ? "dark" : "light") : pref;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = pref;
  root.style.colorScheme = resolved;
}

function applyWithTransition(pref: Pref) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  apply(pref);
  window.setTimeout(() => root.classList.remove("theme-switching"), 320);
}

function Icon({ pref }: { pref: Pref }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (pref === "light")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
    );
  if (pref === "dark")
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThemeSwitcher({ inline = false, className }: { inline?: boolean; className?: string }) {
  const [pref, setPref] = useState<Pref>("system");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s === "light" || s === "dark" || s === "system") setPref(s);
    } catch {}
    setMounted(true);
  }, []);

  // Follow the OS live while the preference is "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [pref]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Pref) {
    setPref(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    applyWithTransition(next);
    if (!inline) {
      setOpen(false);
      btnRef.current?.focus();
    }
  }

  const group = (
    <div role="radiogroup" aria-label="Theme" className={cn("flex rounded border border-line-strong p-1", inline ? "w-full" : "w-[13.5rem]")}>
      {OPTIONS.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(o.value)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-2 rounded-sm text-label transition-colors duration-quick",
              active ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink",
            )}
          >
            <Icon pref={o.value} />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );

  if (inline) return <div className={className}>{group}</div>;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Theme: ${pref}. Change theme`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded text-ink-2 transition-colors duration-quick hover:text-ink"
      >
        {mounted ? <Icon pref={pref} /> : <span className="h-[18px] w-[18px]" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 rounded-md border border-line-strong bg-elevated p-2 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]">
          {group}
        </div>
      )}
    </div>
  );
}
