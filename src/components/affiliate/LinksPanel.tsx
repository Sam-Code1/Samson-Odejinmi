"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";

export type LinkTarget = { key: string; label: string; kind: string; path: string; rate: string | null };

const cleanTag = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 40);

/** One tracked link per page or product, ready to copy or share from a phone. An optional tag shows which channel works. */
export function LinksPanel({ base, code, targets }: { base: string; code: string; targets: LinkTarget[] }) {
  const [tagRaw, setTag] = useState("");
  const tag = cleanTag(tagRaw);
  const url = (path: string) => `${base}${path}?ref=${code}${tag ? `&utm_campaign=${tag}` : ""}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = (t: LinkTarget) => { navigator.share({ title: t.label, text: t.label, url: url(t.path) }).catch(() => { /* cancelled */ }); };

  return (
    <div>
      <div className="max-w-md">
        <label htmlFor="tag" className="mb-2 block text-label text-ink">Where will you share it? (optional)</label>
        <input id="tag" value={tagRaw} onChange={(e) => setTag(e.target.value)} maxLength={40} placeholder="whatsapp-status" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="h-12 w-full rounded border border-line-strong bg-transparent px-4 text-body placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30" />
        <p className="mt-2 text-caption text-ink-3">A short name like <code>instagram</code> or <code>youtube-description</code> is added to your links so you can tell where your clicks come from.{tag && <> Using <strong className="text-ink">{tag}</strong>.</>}</p>
      </div>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {targets.map((t) => (
          <li key={t.key} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="font-medium [overflow-wrap:anywhere]">{t.label}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-3"><span className="fa-tag">{t.kind}</span>{t.rate && <span className="font-semibold text-ink-2">You earn {t.rate}</span>}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <CopyButton value={url(t.path)} label="Copy link" className="min-h-[44px] justify-center border border-line-strong px-3" />
                {canShare && <button type="button" onClick={() => share(t)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded border border-line-strong px-3 text-caption font-semibold text-ink-2 hover:text-ink"><Share2 aria-hidden className="h-3.5 w-3.5" />Share</button>}
              </div>
            </div>
            <code className="mt-3 block break-all rounded bg-surface px-3 py-2 text-caption text-ink-2">{url(t.path)}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
