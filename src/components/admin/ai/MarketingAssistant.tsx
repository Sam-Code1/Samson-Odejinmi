"use client";

import { useState, useTransition } from "react";
import { generateMarketingDrafts, type MarketingDraft } from "@/app/admin/actions/marketing-ai";
import { saveAiDraftAsEmail, saveAiDraftAsPost } from "@/app/admin/actions/marketing";
import { MARKETING_TASKS } from "@/lib/marketing/ai-tasks";
import { CopyButton } from "../CopyButton";

const field = "w-full min-w-0 rounded border border-line-strong bg-transparent px-3 text-base focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm";
const EMAIL_TASKS = ["email_campaign", "launch_sequence"];

/** Generate → review → edit → save as a draft post or draft email. Nothing here sends or publishes. */
export function MarketingAssistant({ products, available }: { products: { id: string; name: string }[]; available: boolean }) {
  const [task, setTask] = useState("social_captions");
  const [productId, setProductId] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("");
  const [brief, setBrief] = useState("");
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  const run = () => start(async () => {
    setError(null);
    const r = await generateMarketingDrafts({ task, productId: productId || undefined, platform, tone, brief });
    if (!r.ok) { setError(r.error); return; }
    setDrafts(r.drafts); setNotes(r.notes);
  });
  const edit = (i: number, patch: Partial<MarketingDraft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = (d: MarketingDraft, as: "post" | "email") => startSave(async () => {
    const r = as === "post" ? await saveAiDraftAsPost(d) : await saveAiDraftAsEmail(d);
    if (r && !r.ok) setError(r.error);
  });

  return (
    <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-4 rounded-lg border border-line bg-elevated p-5">
        <label className="block text-label">What to write
          <select value={task} onChange={(e) => setTask(e.target.value)} className={`${field} mt-1.5 h-11`}>
            {Object.entries(MARKETING_TASKS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block text-label">About (optional)
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={`${field} mt-1.5 h-11`}>
            <option value="">General / no specific product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="mt-1 block text-caption font-normal text-ink-3">Facts come only from this product&apos;s real details.</span>
        </label>
        <label className="block text-label">Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={`${field} mt-1.5 h-11`}>
            {["instagram", "x", "linkedin", "youtube", "facebook", "whatsapp", "email"].map((p) => <option key={p} value={p}>{p === "x" ? "X" : p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
        </label>
        <label className="block text-label">Tone (optional)
          <input value={tone} onChange={(e) => setTone(e.target.value)} maxLength={60} placeholder="friendly, direct, encouraging" className={`${field} mt-1.5 h-11`} />
        </label>
        <label className="block text-label">Brief
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={5} maxLength={3000} placeholder="Who it's for, what's happening (e.g. launch week), anything to include or avoid." className={`${field} mt-1.5 py-2`} />
        </label>
        {error && <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm">{error}</p>}
        <button type="button" onClick={run} disabled={pending || !available} className="h-11 w-full rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90 disabled:opacity-60">{pending ? "Writing…" : "Write drafts"}</button>
        {!available && <p className="text-caption text-warm">Set ANTHROPIC_API_KEY to use the assistant.</p>}
      </div>

      <div className="min-w-0 space-y-4" aria-live="polite">
        {drafts.length === 0 && !pending && <p className="rounded-lg border border-dashed border-line-strong p-6 text-body-sm text-ink-3">Drafts appear here. Review and edit them, then save one as a draft post or draft email. The assistant never sends or publishes anything.</p>}
        {pending && <div className="space-y-3"><div className="skeleton h-32" /><div className="skeleton h-32" /></div>}
        {notes && <p className="border-l-2 border-violet pl-4 text-body-sm text-ink-2">Check before using: {notes}</p>}
        {drafts.map((d, i) => (
          <article key={i} className="rounded-lg border border-line bg-elevated p-5">
            <input aria-label="Draft title" value={d.title} onChange={(e) => edit(i, { title: e.target.value })} className={`${field} h-10 font-semibold`} />
            {d.subject !== undefined && <input aria-label="Subject" value={d.subject ?? ""} onChange={(e) => edit(i, { subject: e.target.value })} placeholder="Subject" className={`${field} mt-2 h-10`} />}
            <textarea aria-label="Draft text" value={d.body} onChange={(e) => edit(i, { body: e.target.value })} rows={Math.min(14, Math.max(4, d.body.split("\n").length + 1))} className={`${field} mt-2 py-2`} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyButton value={d.body} label="Copy text" className="min-h-[40px] border border-line-strong px-3" />
              <button type="button" disabled={saving} onClick={() => save(d, "post")} className="min-h-[40px] rounded border border-line-strong px-3 text-label hover:border-ink disabled:opacity-60">Save as draft post</button>
              {(EMAIL_TASKS.includes(task) || d.subject) && <button type="button" disabled={saving} onClick={() => save(d, "email")} className="min-h-[40px] rounded border border-line-strong px-3 text-label hover:border-ink disabled:opacity-60">Save as draft email</button>}
              {d.utm_campaign && <span className="text-caption text-ink-3">utm_campaign: {d.utm_campaign}</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
