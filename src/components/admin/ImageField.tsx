"use client";

import { useState } from "react";
import { useFieldError } from "./FormContext";
import { cn } from "@/lib/utils";

export type LibraryImage = { url: string; filename: string };

const control = "w-full rounded border border-line-strong bg-transparent px-3 text-body-sm text-ink hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30";

/**
 * Upload a new image, pick one already in the media library, or remove the current one.
 * The server resolves it (see resolveImageField): an upload wins, then a library pick, then remove.
 */
export function ImageField({ name, label, current, library, hint, className }: { name: string; label: string; current: string | null; library: LibraryImage[]; hint?: string; className?: string }) {
  const [picked, setPicked] = useState("");
  const [remove, setRemove] = useState(false);
  const error = useFieldError(name);
  const preview = picked || (remove ? null : current);

  return (
    <div className={cn("sm:col-span-2", className)}>
      <p className="mb-1.5 text-caption font-semibold text-ink">{label}</p>
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <div className="aspect-[4/3] overflow-hidden rounded border border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-caption text-ink-3">No image</span>}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-caption text-ink-3">Upload new (PNG, JPG, WebP, GIF or AVIF, up to 5 MB)</span>
            <input type="file" name={`${name}_file`} accept="image/png,image/jpeg,image/webp,image/gif,image/avif" aria-invalid={!!error}
              className={cn(control, "h-auto py-2 file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-ink")} />
          </label>
          {library.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-caption text-ink-3">…or choose from the media library</span>
              <select name={`${name}_library`} value={picked} onChange={(e) => { setPicked(e.target.value); setRemove(false); }} className={cn(control, "h-10 bg-canvas")}>
                <option value="">Keep current</option>
                {library.map((m) => <option key={m.url} value={m.url}>{m.filename}</option>)}
              </select>
            </label>
          )}
          {current && (
            <label className="flex items-center gap-2 text-caption text-ink-2">
              <input type="checkbox" name={`${name}_remove`} checked={remove} onChange={(e) => { setRemove(e.target.checked); if (e.target.checked) setPicked(""); }} className="h-4 w-4 accent-[rgb(var(--blue))]" />
              Remove the current image
            </label>
          )}
          {error ? <p role="alert" className="text-caption text-warm">{error}</p> : hint ? <p className="text-caption text-ink-3">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
