"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { generateContentDraft } from "@/app/admin/actions/ai";
import { CONTENT_TASKS, type ContentTask } from "@/lib/ai/content";
import { CopyButton } from "../CopyButton";
import { cn } from "@/lib/utils";

const control = "w-full rounded border border-line-strong bg-transparent px-3 text-body-sm text-ink hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 disabled:opacity-60";
const label = "mb-1.5 block text-caption font-semibold text-ink";

/** Drafts text for the admin to copy. It never writes to the site or the database. */
export function ContentAssistant({ configured, courses, lessons }: { configured: boolean; courses: { id: string; title: string }[]; lessons: { id: string; title: string; course_id: string }[] }) {
  const [task, setTask] = useState<ContentTask>("lesson_summary");
  const [from, setFrom] = useState<"lesson" | "course" | "text">("lesson");
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [result, setResult] = useState<{ draft: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    start(async () => {
      const res = await generateContentDraft({ task, lessonId: from === "lesson" ? lessonId : undefined, courseId: from === "course" ? courseId : undefined, text: from === "text" ? text : undefined, extra });
      if (!res.ok) { setError(res.error); setResult(null); return; }
      setResult({ draft: res.draft, model: res.model });
    });
  };
  const ready = configured && (from === "lesson" ? !!lessonId : from === "course" ? !!courseId : text.trim().length >= 50);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-5 rounded-lg border border-line bg-elevated p-5 sm:p-6">
        <label className="block"><span className={label}>What should it draft?</span>
          <select value={task} onChange={(e) => setTask(e.target.value as ContentTask)} className={cn(control, "h-10 bg-canvas")}>
            {Object.entries(CONTENT_TASKS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <fieldset><legend className={label}>From</legend>
          <div className="flex flex-wrap gap-4 text-body-sm">
            {([["lesson", "A lesson"], ["course", "A course"], ["text", "Pasted text"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><input type="radio" name="from" checked={from === v} onChange={() => setFrom(v)} className="h-4 w-4 accent-[rgb(var(--blue))]" />{l}</label>
            ))}
          </div>
        </fieldset>
        {from !== "text" && (
          <label className="block"><span className={label}>Course</span>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setLessonId(""); }} className={cn(control, "h-10 bg-canvas")}>
              <option value="">Choose a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
        )}
        {from === "lesson" && (
          <label className="block"><span className={label}>Lesson</span>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!courseId} className={cn(control, "h-10 bg-canvas")}>
              <option value="">Choose a lesson…</option>{lessons.filter((l) => l.course_id === courseId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        )}
        {from === "text" && (
          <label className="block"><span className={label}>Material</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} className={cn(control, "resize-y py-2")} />
            <span className="mt-1 block text-caption text-ink-3">{text.length.toLocaleString()} / 20,000 characters</span>
          </label>
        )}
        <label className="block"><span className={label}>Anything else to consider? (optional)</span>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} maxLength={1000} placeholder={task === "quiz_explanation" ? "Paste the question and the correct answer here." : "e.g. keep it under 80 words"} className={cn(control, "resize-y py-2")} />
        </label>
        <button type="button" onClick={run} disabled={!ready || pending} className="inline-flex h-11 items-center gap-2 rounded bg-ink px-5 text-label text-canvas hover:bg-ink/90 disabled:opacity-50">
          <Sparkles aria-hidden className="h-4 w-4" />{pending ? "Drafting…" : "Draft it"}
        </button>
      </div>

      <div className="rounded-lg border border-line bg-elevated p-5 sm:p-6" aria-live="polite">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
          <h2 className="text-admin-section">Draft</h2>
          {result && <CopyButton value={result.draft} label="Copy draft" />}
        </div>
        {pending ? <div className="space-y-3" role="status" aria-label="Drafting"><div className="skeleton h-5 w-full" /><div className="skeleton h-5 w-5/6" /><div className="skeleton h-5 w-4/6" /></div>
          : error ? <p role="alert" className="flex items-start gap-2 text-body-sm text-ink-2"><AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warm" />{error}</p>
          : result ? (
            <>
              <p className="whitespace-pre-line text-body text-ink">{result.draft}</p>
              <p className="mt-5 border-t border-line pt-3 text-caption text-ink-3">AI draft ({result.model}). Check every fact before using it. Nothing has been changed on the site: paste it where you want it and save there.</p>
            </>
          ) : <p className="text-body-sm text-ink-3">Your draft appears here. It&apos;s never saved or published automatically.</p>}
      </div>
    </div>
  );
}
