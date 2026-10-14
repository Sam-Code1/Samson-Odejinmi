"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { askLessonAssistant } from "@/app/admin/actions/ai";
import { CopyButton } from "../CopyButton";
import { cn } from "@/lib/utils";

const control = "w-full rounded border border-line-strong bg-transparent px-3 text-body-sm text-ink hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 disabled:opacity-60";
const label = "mb-1.5 block text-caption font-semibold text-ink";

const PRESETS = [
  ["objectives", "Learning objectives"], ["summary", "Summarise"], ["beginner", "Beginner explanation"], ["exercises", "Practice exercises"],
  ["glossary", "Glossary terms"], ["quiz", "Quiz question ideas"], ["improve", "Suggest improvements"], ["rewrite", "Rewrite for beginners"],
] as const;

type L = { id: string; title: string; course_id: string; module_id: string };

/** Admin-only. Answers are drafts to review and copy; nothing is saved to the lesson. */
export function LessonAssistant({ configured, courses, modules, lessons, initialLesson }: {
  configured: boolean; courses: { id: string; title: string }[]; modules: { id: string; title: string; course_id: string }[]; lessons: L[]; initialLesson?: string;
}) {
  const start0 = lessons.find((l) => l.id === initialLesson);
  const [courseId, setCourseId] = useState(start0?.course_id ?? "");
  const [moduleId, setModuleId] = useState(start0?.module_id ?? "");
  const [lessonId, setLessonId] = useState(start0?.id ?? "");
  const [preset, setPreset] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ answer: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setError(null);
    start(async () => {
      const res = await askLessonAssistant({ lessonId, preset: preset || undefined, question });
      if (!res.ok) { setError(res.error); setResult(null); return; }
      setResult({ answer: res.answer, model: res.model });
    });
  };
  const ready = configured && !!lessonId && (!!preset || question.trim().length > 0) && !pending;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-5 rounded-lg border border-line bg-elevated p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <label className="block"><span className={label}>Course</span>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setModuleId(""); setLessonId(""); }} className={cn(control, "h-11 bg-canvas")}>
              <option value="">Choose…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Module</span>
            <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} disabled={!courseId} className={cn(control, "h-11 bg-canvas")}>
              <option value="">All modules</option>{modules.filter((m) => m.course_id === courseId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Lesson</span>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!courseId} className={cn(control, "h-11 bg-canvas")}>
              <option value="">Choose…</option>{lessons.filter((l) => l.course_id === courseId && (!moduleId || l.module_id === moduleId)).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className={label}>Task</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([k, t]) => (
              <button key={k} type="button" aria-pressed={preset === k} onClick={() => setPreset(preset === k ? "" : k)}
                className={cn("min-h-[40px] rounded-full border px-3.5 text-body-sm transition-colors", preset === k ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink")}>{t}</button>
            ))}
          </div>
        </fieldset>
        <label className="block"><span className={label}>Or ask anything about this lesson</span>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. Where would a beginner most likely get stuck?" className={cn(control, "resize-y py-2.5")} />
        </label>
        <button type="button" onClick={run} disabled={!ready} className="inline-flex h-11 items-center gap-2 rounded bg-ink px-5 text-label text-canvas hover:bg-ink/90 disabled:opacity-50">
          <Sparkles aria-hidden className="h-4 w-4" />{pending ? "Thinking…" : "Ask"}
        </button>
        <p className="text-caption text-ink-3">Uses the lesson text, transcript and your notes. Nothing is changed in the lesson.</p>
      </div>

      <div className="min-w-0 rounded-lg border border-line bg-elevated p-5 sm:p-6" aria-live="polite">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
          <h2 className="text-admin-section">Draft</h2>
          {result && <CopyButton value={result.answer} label="Copy" />}
        </div>
        {pending ? <div className="space-y-3" role="status" aria-label="Thinking"><div className="skeleton h-5 w-full" /><div className="skeleton h-5 w-11/12" /><div className="skeleton h-5 w-4/6" /></div>
          : error ? <p role="alert" className="flex items-start gap-2 text-body-sm text-ink-2"><AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warm" />{error}</p>
          : result ? (
            <>
              <p className="whitespace-pre-line break-words text-body text-ink">{result.answer}</p>
              <p className="mt-5 border-t border-line pt-3 text-caption text-ink-3">AI draft ({result.model}). Review before using it anywhere.</p>
            </>
          ) : <p className="text-body-sm text-ink-3">Choose a lesson and a task. The answer appears here as a draft.</p>}
      </div>
    </div>
  );
}
