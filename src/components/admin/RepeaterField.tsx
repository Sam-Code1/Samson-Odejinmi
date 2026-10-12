"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useFieldError } from "./FormContext";
import { cn } from "@/lib/utils";

type Item = { title?: string; body?: string; meta?: string };
type Fields = { title?: string; body?: string; meta?: string };

const control = "w-full rounded border border-line-strong bg-transparent px-3 text-body-sm text-ink placeholder:text-ink-3 hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30";

/**
 * An ordered list of small structured items (cards, timeline entries, steps). Serialised as JSON into one hidden
 * input; the server re-validates every field and length, so nothing from here is trusted as-is.
 */
export function RepeaterField({ name, label, fields, initial, max = 20, help, className }: { name: string; label: string; fields: Fields; initial: Item[]; max?: number; help?: string; className?: string }) {
  const [items, setItems] = useState<Item[]>(initial.length ? initial : []);
  const error = useFieldError(name);
  const keys = (["meta", "title", "body"] as const).filter((k) => fields[k]);

  const update = (i: number, k: keyof Item, v: string) => setItems((p) => p.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const move = (i: number, d: -1 | 1) => setItems((p) => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-caption font-semibold text-ink">{label}</p>
        <span className="text-caption text-ink-3">{items.length} / {max}</span>
      </div>
      {help && <p className="mb-3 text-caption text-ink-3">{help}</p>}
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="rounded border border-line bg-canvas p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`} className="rounded p-1.5 text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} down`} className="rounded p-1.5 text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`} className="rounded p-1.5 text-warm hover:bg-warm/10"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className={cn("grid gap-2", keys.length > 1 && "sm:grid-cols-2")}>
              {keys.map((k) => (
                <label key={k} className={cn("block", k === "body" && "sm:col-span-2")}>
                  <span className="mb-1 block text-caption text-ink-3">{fields[k]}</span>
                  {k === "body"
                    ? <textarea value={it[k] ?? ""} onChange={(e) => update(i, k, e.target.value)} rows={2} maxLength={600} className={cn(control, "resize-y py-2")} />
                    : <input value={it[k] ?? ""} onChange={(e) => update(i, k, e.target.value)} maxLength={160} className={cn(control, "h-9")} />}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {items.length < max && (
        <button type="button" onClick={() => setItems((p) => [...p, {}])} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-dashed border-line-strong px-3 text-caption font-semibold text-ink-2 hover:border-ink hover:text-ink">
          <Plus aria-hidden className="h-3.5 w-3.5" />Add item
        </button>
      )}
      {error && <p role="alert" className="mt-1.5 text-caption text-warm">{error}</p>}
    </div>
  );
}
