"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { globalSearch, type SearchHit } from "@/app/app-actions";
import { cn } from "@/lib/utils";

/**
 * Global search, Cmd/Ctrl+K (or the search button). Results come from the server and respect the person's role.
 * Keyboard: ↑/↓ to move, Enter to open, Esc to close. Focus returns to where it was.
 */
export function CommandPalette({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); last.current = document.activeElement as HTMLElement; setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) { setTimeout(() => input.current?.focus(), 0); document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; last.current?.focus?.(); }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const search = (v: string) => {
    setQ(v);
    window.clearTimeout(timer.current);
    if (v.trim().length < 2) { setHits([]); return; }
    timer.current = window.setTimeout(() => start(async () => { setHits(await globalSearch(v)); setActive(0); }), 220);
  };
  const go = (h: SearchHit) => { setOpen(false); setQ(""); setHits([]); if (h.href.startsWith("/api/")) window.location.href = h.href; else router.push(h.href); };
  const groups = hits.reduce<Record<string, { hit: SearchHit; i: number }[]>>((m, h, i) => { (m[h.group] ??= []).push({ hit: h, i }); return m; }, {});

  return (
    <>
      <button type="button" onClick={() => { last.current = document.activeElement as HTMLElement; setOpen(true); }} aria-label="Search (Ctrl+K)"
        className="flex h-11 items-center gap-2 rounded px-2.5 text-ink-2 hover:bg-surface hover:text-ink sm:border sm:border-line sm:px-3">
        <Search aria-hidden className="h-4 w-4" strokeWidth={1.5} /><span className="hidden text-caption sm:inline">Search</span><kbd className="hidden rounded border border-line px-1.5 text-meta text-ink-3 md:inline">Ctrl K</kbd>
      </button>
      {/* Portal: the admin/student headers use backdrop blur, which would trap a fixed overlay inside them. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search">
          <button type="button" aria-label="Close search" onClick={() => setOpen(false)} className="absolute inset-0 bg-canvas/70 backdrop-blur-sm motion-reduce:backdrop-blur-none" />
          <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-elevated shadow-[0_30px_80px_-30px_rgb(var(--ink)/0.5)]">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
              <input ref={input} value={q} onChange={(e) => search(e.target.value)} placeholder={placeholder} aria-label="Search" role="combobox" aria-expanded={hits.length > 0} aria-controls="cmdk-list"
                aria-activedescendant={hits[active] ? `cmdk-${active}` : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
                }}
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
              {pending && <span className="loader !h-4 !w-4" aria-hidden />}
            </div>
            <ul id="cmdk-list" role="listbox" className="max-h-[55vh] overflow-y-auto py-2">
              {q.trim().length >= 2 && !pending && hits.length === 0 && <li className="px-4 py-6 text-center text-body-sm text-ink-3">No results for “{q}”.</li>}
              {q.trim().length < 2 && <li className="px-4 py-6 text-center text-body-sm text-ink-3">Type at least 2 characters.</li>}
              {Object.entries(groups).map(([g, list]) => (
                <li key={g} role="presentation">
                  <p className="px-4 pb-1 pt-3 text-meta font-semibold uppercase tracking-wider text-ink-3">{g}</p>
                  <ul role="presentation">
                    {list.map(({ hit, i }) => (
                      <li key={`${hit.href}-${i}`} id={`cmdk-${i}`} role="option" aria-selected={i === active}>
                        <button type="button" onClick={() => go(hit)} onMouseEnter={() => setActive(i)} className={cn("flex min-h-[44px] w-full flex-col justify-center px-4 py-2 text-left", i === active ? "bg-surface" : "")}>
                          <span className="truncate text-body-sm">{hit.title}</span>
                          {hit.subtitle && <span className="truncate text-caption text-ink-3">{hit.subtitle}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
