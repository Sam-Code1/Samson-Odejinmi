"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); window.setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked */ } }}
      className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-caption font-semibold text-ink-2 hover:bg-surface hover:text-ink" aria-live="polite">
      {done ? <Check aria-hidden className="h-3.5 w-3.5 text-blue" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}{done ? "Copied" : label}
    </button>
  );
}
