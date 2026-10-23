"use client";

import { Download } from "lucide-react";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Download aria-hidden className="h-4 w-4" />{label}</button>;
}
