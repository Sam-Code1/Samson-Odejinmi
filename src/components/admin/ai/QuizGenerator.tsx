"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { generateQuizDraft, regenerateQuestion, saveGeneratedQuestions, type SaveTarget } from "@/app/admin/actions/ai";
import type { DraftQuestion, GenerationSettings, QType } from "@/lib/ai/quiz";
import type { SourceKey } from "@/lib/ai/sources";
import { useToast } from "../Toast";
import { cn } from "@/lib/utils";

export type GenLesson = {
  id: string; title: string; course_id: string; module_id: string;
  chars: { content: number; transcript: number; notes: number };
  resources: { id: string; title: string; scope: string }[];
};
type Review = DraftQuestion & { state: "pending" | "approved" | "rejected"; editing?: boolean; busy?: boolean };

const control = "w-full rounded border border-line-strong bg-transparent px-3 text-body-sm text-ink hover:border-ink/40 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 disabled:opacity-60";
const label = "mb-1.5 block text-caption font-semibold text-ink";
const DIFF_LABEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", mixed: "Mixed" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-line bg-elevated p-5 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-caption font-semibold tabular-nums">{n}</span>
        <h2 className="text-admin-section">{title}</h2>
      </div>
      {children}
    </fieldset>
  );
}

export function QuizGenerator({ configured, provider, model, courses, modules, lessons, quizzes, initial }: {
  configured: boolean; provider: string; model: string | null;
  courses: { id: string; title: string }[]; modules: { id: string; title: string; course_id: string }[]; lessons: GenLesson[];
  quizzes: { id: string; title: string; course_id: string; lesson_id: string | null; status: string }[];
  initial: { course?: string; lesson?: string; quiz?: string };
}) {
  const toast = useToast();
  const initialLesson = lessons.find((l) => l.id === initial.lesson);
  const [courseId, setCourseId] = useState(initialLesson?.course_id ?? initial.course ?? "");
  const [moduleId, setModuleId] = useState(initialLesson?.module_id ?? "");
  const [lessonId, setLessonId] = useState(initialLesson?.id ?? "");
  const lesson = lessons.find((l) => l.id === lessonId);

  const [sources, setSources] = useState<SourceKey[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<GenerationSettings>({ count: 10, difficulty: "beginner", types: ["multiple_choice", "true_false"], explanations: true });

  const [drafts, setDrafts] = useState<Review[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ generationId: string | null; model: string; sourceChars: number } | null>(null);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState<{ saved: number; skipped: string[]; quizId: string | null } | null>(null);

  const courseQuizzes = quizzes.filter((q) => q.course_id === courseId);
  const [target, setTarget] = useState<"bank" | "quiz" | "new">(initial.quiz && quizzes.some((q) => q.id === initial.quiz) ? "quiz" : "bank");
  const [quizId, setQuizId] = useState(initial.quiz ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [keepPending, setKeepPending] = useState(false);

  // Sensible default sources whenever the lesson changes: everything that has content.
  useEffect(() => {
    if (!lesson) { setSources([]); setResourceIds([]); return; }
    setSources((["content", "transcript", "notes"] as const).filter((k) => lesson.chars[k] > 0));
    setResourceIds([]);
  }, [lesson]);

  const approved = drafts.filter((d) => d.state === "approved");
  const pending = drafts.filter((d) => d.state === "pending").length;
  const dirty = drafts.length > 0 && !saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const filteredModules = modules.filter((m) => m.course_id === courseId);
  const filteredLessons = lessons.filter((l) => l.course_id === courseId && (!moduleId || l.module_id === moduleId));
  const sourceChars = useMemo(() => (lesson ? sources.filter((s) => s !== "resources").reduce((n, s) => n + lesson.chars[s as "content" | "transcript" | "notes"], 0) : 0), [lesson, sources]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const update = (key: string, patch: Partial<Review>) => setDrafts((p) => p.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const canGenerate = configured && !!lesson && sources.length > 0 && (!sources.includes("resources") || resourceIds.length > 0) && settings.types.length > 0 && !generating;

  const generate = () => {
    if (!lesson) return;
    if (drafts.length && !saved && !window.confirm("Generating again replaces the current drafts. Continue?")) return;
    setError(null); setSaved(null);
    startGenerate(async () => {
      const res = await generateQuizDraft({ lessonId: lesson.id, sources, resourceIds, settings });
      if (!res.ok) { setError(res.error); setDrafts([]); setNotes([]); return; }
      setDrafts(res.drafts.map((d) => ({ ...d, state: "pending" })));
      setNotes(res.notes);
      setMeta({ generationId: res.generationId, model: res.model, sourceChars: res.sourceChars });
      if (!newTitle) setNewTitle(`${lesson.title} quiz`);
    });
  };

  const regenerate = async (d: Review) => {
    if (!lesson) return;
    update(d.key, { busy: true });
    const res = await regenerateQuestion({ lessonId: lesson.id, sources, resourceIds, settings, original: d, others: drafts.filter((x) => x.key !== d.key).map((x) => x.question) });
    if (!res.ok) { update(d.key, { busy: false }); toast("error", res.error); return; }
    setDrafts((p) => p.map((x) => (x.key === d.key ? { ...res.draft, state: "pending" } : x)));
    toast("success", "Question regenerated. Review the new version.");
  };

  const save = () => {
    if (!lesson || !(approved.length || (keepPending && pending))) return;
    const t: SaveTarget = target === "quiz" ? { mode: "quiz", quizId } : target === "new" ? { mode: "new", title: newTitle } : { mode: "bank" };
    if (target === "quiz" && !quizId) { toast("error", "Choose a quiz, or save to the question bank only."); return; }
    startSave(async () => {
      const strip = ({ state: _s, editing: _e, busy: _b, ...d }: Review) => d;
      const res = await saveGeneratedQuestions({
        lessonId: lesson.id, generationId: meta?.generationId ?? null, target: t, drafts: approved.map(strip),
        forReview: keepPending ? drafts.filter((d) => d.state === "pending").map(strip) : [],
      });
      if (!res.ok) { toast("error", res.error); return; }
      setSaved(res);
      toast("success", `${res.saved} ${res.saved === 1 ? "question" : "questions"} saved as approved, unpublished drafts.`);
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. What to generate from */}
      <Step n={1} title="Choose the lesson">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block"><span className={label}>Course</span>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setModuleId(""); setLessonId(""); }} className={cn(control, "h-10 bg-canvas")}>
              <option value="">Choose a course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Module</span>
            <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} disabled={!courseId} className={cn(control, "h-10 bg-canvas")}>
              <option value="">All modules</option>{filteredModules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Lesson</span>
            <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!courseId} className={cn(control, "h-10 bg-canvas")}>
              <option value="">{courseId ? (filteredLessons.length ? "Choose a lesson…" : "No lessons yet") : "Choose a course first"}</option>
              {filteredLessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        </div>
      </Step>

      <Step n={2} title="Choose the source material">
        {!lesson ? <p className="text-body-sm text-ink-3">Choose a lesson to see its material.</p> : (
          <div className="space-y-4">
            <p className="text-body-sm text-ink-2">Questions are written only from what you select here, not from general knowledge.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([["content", "Lesson text", "Description and lesson text"], ["transcript", "Transcript", "Video transcript"], ["notes", "Lesson notes", "Your teaching notes"]] as const).map(([k, title, hint]) => {
                const n = lesson.chars[k];
                return (
                  <label key={k} className={cn("flex items-start gap-3 rounded border p-3 text-body-sm", n ? "cursor-pointer border-line hover:border-line-strong" : "border-dashed border-line opacity-60")}>
                    <input type="checkbox" checked={sources.includes(k)} disabled={!n} onChange={() => setSources((s) => toggle(s, k))} className="mt-0.5 h-4 w-4 accent-[rgb(var(--blue))]" />
                    <span><span className="font-medium">{title}</span><span className="block text-caption text-ink-3">{n ? `${hint} · ${n.toLocaleString()} characters` : `Empty. Add it on the lesson's edit page.`}</span></span>
                  </label>
                );
              })}
              <label className={cn("flex items-start gap-3 rounded border p-3 text-body-sm", lesson.resources.length ? "cursor-pointer border-line hover:border-line-strong" : "border-dashed border-line opacity-60")}>
                <input type="checkbox" checked={sources.includes("resources")} disabled={!lesson.resources.length} onChange={() => setSources((s) => toggle(s, "resources" as SourceKey))} className="mt-0.5 h-4 w-4 accent-[rgb(var(--blue))]" />
                <span><span className="font-medium">Uploaded PDF / text resources</span><span className="block text-caption text-ink-3">{lesson.resources.length ? `${lesson.resources.length} readable ${lesson.resources.length === 1 ? "file" : "files"}` : "No PDF or text files uploaded for this lesson or course."}</span></span>
              </label>
            </div>
            {sources.includes("resources") && (
              <div className="rounded border border-line p-3">
                <p className="mb-2 text-caption font-semibold">Files to read (up to 5)</p>
                <ul className="space-y-1">
                  {lesson.resources.map((r) => (
                    <li key={r.id}><label className="flex items-center gap-2 text-body-sm"><input type="checkbox" checked={resourceIds.includes(r.id)} disabled={!resourceIds.includes(r.id) && resourceIds.length >= 5} onChange={() => setResourceIds((s) => toggle(s, r.id))} className="h-4 w-4 accent-[rgb(var(--blue))]" />{r.title}<span className="text-caption text-ink-3">({r.scope === "lesson" ? "this lesson" : "whole course"})</span></label></li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-caption text-ink-3">Up to 60,000 characters of material are sent per request. If you select more, you&apos;ll be told exactly what was shortened.{sourceChars > 60000 && <strong className="ml-1 text-warm">The selected text is {sourceChars.toLocaleString()} characters, so it will be shortened.</strong>}</p>
          </div>
        )}
      </Step>

      <Step n={3} title="Settings">
        <div className="grid gap-5 md:grid-cols-4">
          <label className="block"><span className={label}>Number of questions</span>
            <select value={settings.count} onChange={(e) => setSettings((s) => ({ ...s, count: Number(e.target.value) }))} className={cn(control, "h-10 bg-canvas")}>
              {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="block"><span className={label}>Difficulty</span>
            <select value={settings.difficulty} onChange={(e) => setSettings((s) => ({ ...s, difficulty: e.target.value as GenerationSettings["difficulty"] }))} className={cn(control, "h-10 bg-canvas")}>
              {Object.entries(DIFF_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div><span className={label}>Question types</span>
            <div className="flex flex-col gap-2 pt-1">
              {([["multiple_choice", "Multiple choice"], ["true_false", "True / false"]] as [QType, string][]).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 text-body-sm"><input type="checkbox" checked={settings.types.includes(v)} onChange={() => setSettings((s) => ({ ...s, types: toggle(s.types, v) }))} className="h-4 w-4 accent-[rgb(var(--blue))]" />{l}</label>
              ))}
            </div>
          </div>
          <div><span className={label}>Explanations</span>
            <label className="flex items-center gap-2 pt-1 text-body-sm"><input type="checkbox" checked={settings.explanations} onChange={(e) => setSettings((s) => ({ ...s, explanations: e.target.checked }))} className="h-4 w-4 accent-[rgb(var(--blue))]" />Generate an explanation for each answer</label>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-line pt-5">
          <button type="button" onClick={generate} disabled={!canGenerate} className="inline-flex h-11 items-center gap-2 rounded bg-ink px-5 text-label text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50">
            <Sparkles aria-hidden className="h-4 w-4" />{generating ? "Generating…" : drafts.length ? "Generate again" : "Generate questions"}
          </button>
          <span className="text-caption text-ink-3">{configured ? `${provider} · ${model}. Runs on the server. Usually 20–60 seconds.` : "AI isn't configured."}</span>
        </div>
      </Step>

      {/* Results */}
      <div aria-live="polite">
        {generating && (
          <div className="space-y-3" role="status" aria-label="Generating questions">
            <p className="text-body-sm text-ink-2">Reading the material and writing questions… this can take up to a minute.</p>
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 w-full rounded-lg" />)}
          </div>
        )}
        {!generating && error && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-warm/40 bg-elevated p-5">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warm" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-label">Quiz generation failed.</p>
              <p className="mt-1 text-body-sm text-ink-2">{error}</p>
              {canGenerate && <button type="button" onClick={generate} className="mt-3 inline-flex h-9 items-center gap-2 rounded border border-line-strong px-3 text-label hover:border-ink"><RefreshCw aria-hidden className="h-4 w-4" />Retry</button>}
            </div>
          </div>
        )}
      </div>

      {!generating && drafts.length > 0 && (
        <section aria-labelledby="review-h" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="review-h" className="text-admin-section">Review {drafts.length} draft {drafts.length === 1 ? "question" : "questions"}</h2>
              <p className="mt-1 text-body-sm text-ink-3">{approved.length} approved · {pending} to review{meta ? ` · ${meta.model}` : ""}. Nothing is saved until you click Save.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDrafts((p) => p.map((d) => (d.editing ? d : { ...d, state: "approved" })))} className="inline-flex h-9 items-center gap-1.5 rounded border border-line-strong px-3 text-label hover:border-ink"><Check aria-hidden className="h-4 w-4" />Approve all</button>
              <button type="button" onClick={() => setDrafts((p) => p.map((d) => ({ ...d, state: "rejected" })))} className="inline-flex h-9 items-center gap-1.5 rounded border border-line-strong px-3 text-label hover:border-ink"><X aria-hidden className="h-4 w-4" />Reject all</button>
            </div>
          </div>
          {notes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-violet/40 bg-elevated p-4 text-caption text-ink-2">
              {notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <ol className="space-y-4">
            {drafts.map((d, i) => <ReviewCard key={d.key} d={d} n={i + 1} onChange={(p) => update(d.key, p)} onRegenerate={() => regenerate(d)} onDelete={() => setDrafts((p) => p.filter((x) => x.key !== d.key))} />)}
          </ol>

          {/* Save */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-lg lg:border lg:px-5">
            {saved ? (
              <div className="flex flex-wrap items-center gap-4 text-body-sm">
                <span className="flex items-center gap-2 font-semibold"><Check aria-hidden className="h-4 w-4 text-blue" />{saved.saved} saved as approved, unpublished questions.</span>
                {saved.skipped.length > 0 && <span className="text-ink-3">{saved.skipped.join(" ")}</span>}
                {saved.quizId ? <Link href={`/admin/quizzes/${saved.quizId}`} className="underline underline-offset-4">Open the quiz to publish them</Link> : <Link href={`/admin/questions?lesson=${lessonId}&course=${courseId}`} className="underline underline-offset-4">Open in the question bank</Link>}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-4">
                <label className="block"><span className={label}>Save approved questions to</span>
                  <select value={target} onChange={(e) => setTarget(e.target.value as typeof target)} className={cn(control, "h-10 bg-canvas")}>
                    <option value="bank">Question bank only</option>
                    <option value="quiz" disabled={!courseQuizzes.length}>An existing quiz</option>
                    <option value="new">A new draft quiz for this lesson</option>
                  </select>
                </label>
                {target === "quiz" && (
                  <label className="block min-w-[14rem]"><span className={label}>Quiz</span>
                    <select value={quizId} onChange={(e) => setQuizId(e.target.value)} className={cn(control, "h-10 bg-canvas")}>
                      <option value="">Choose a quiz…</option>{courseQuizzes.map((q) => <option key={q.id} value={q.id}>{q.title}{q.status === "published" ? " (published)" : ""}</option>)}
                    </select>
                  </label>
                )}
                {target === "new" && (
                  <label className="block min-w-[16rem]"><span className={label}>New quiz title</span>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={140} className={cn(control, "h-10")} />
                  </label>
                )}
                <button type="button" onClick={save} disabled={!(approved.length || (keepPending && pending)) || saving || drafts.some((d) => d.editing)} className="inline-flex h-10 items-center gap-2 rounded bg-ink px-5 text-label text-canvas hover:bg-ink/90 disabled:opacity-50">
                  {saving ? "Saving…" : `Save ${approved.length} approved`}
                </button>
                {pending > 0 && (
                  <label className="flex w-full items-center gap-2 text-body-sm text-ink-2">
                    <input type="checkbox" checked={keepPending} onChange={(e) => setKeepPending(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--blue))]" />
                    Also keep the {pending} unreviewed {pending === 1 ? "question" : "questions"} in the bank as “AI generated” for later review
                  </label>
                )}
                <p className="w-full text-caption text-ink-3">Saved questions stay unpublished. Publish them from the quiz or the question bank when you&apos;re ready.{drafts.some((d) => d.editing) ? " Finish editing first." : ""}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewCard({ d, n, onChange, onRegenerate, onDelete }: { d: Review; n: number; onChange: (p: Partial<Review>) => void; onRegenerate: () => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<Review>(d);
  useEffect(() => setDraft(d), [d]);
  const tone = d.state === "approved" ? "border-blue/50" : d.state === "rejected" ? "border-line opacity-60" : "border-line";
  const btn = "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-caption font-semibold transition-colors disabled:opacity-40";

  if (d.editing) {
    const isTf = draft.type === "true_false";
    return (
      <li className="rounded-lg border border-line-strong bg-elevated p-5">
        <p className="mb-3 text-caption text-ink-3">Editing question {n}</p>
        <label className="block"><span className={label}>Question</span><textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} rows={2} maxLength={500} className={cn(control, "resize-y py-2")} /></label>
        <fieldset className="mt-4"><legend className={label}>Options (select the correct one)</legend>
          <ul className="space-y-2">
            {draft.options.map((o, i) => (
              <li key={i} className="flex items-center gap-3">
                <input type="radio" name={`correct-${d.key}`} checked={draft.correct_answer === i} onChange={() => setDraft({ ...draft, correct_answer: i })} aria-label={`Option ${i + 1} is correct`} className="h-4 w-4 accent-[rgb(var(--blue))]" />
                <input value={o} disabled={isTf} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, j) => (j === i ? e.target.value : x)) })} maxLength={200} className={cn(control, "h-9")} aria-label={`Option ${i + 1}`} />
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_12rem]">
          <label className="block"><span className={label}>Explanation</span><textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={2} maxLength={800} className={cn(control, "resize-y py-2")} /></label>
          <label className="block"><span className={label}>Difficulty</span>
            <select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Review["difficulty"] })} className={cn(control, "h-10 bg-canvas")}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => onChange({ ...draft, editing: false, state: "approved" })} disabled={draft.question.trim().length < 10 || draft.options.some((o) => !o.trim())} className="h-9 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90 disabled:opacity-50">Save and approve</button>
          <button type="button" onClick={() => onChange({ editing: false })} className="h-9 rounded border border-line-strong px-4 text-label hover:border-ink">Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li className={cn("rounded-lg border bg-elevated p-5 transition-colors", tone)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-body font-medium"><span className="mr-2 tabular-nums text-ink-3">{n}.</span>{d.question}</p>
        <span className="flex flex-wrap gap-1.5 text-meta">
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-ink-2">{d.type === "true_false" ? "True / false" : "Multiple choice"}</span>
          <span className="rounded-full border border-line-strong px-2 py-0.5 text-ink-2">{DIFF_LABEL[d.difficulty]}</span>
          {d.state !== "pending" && <span className={cn("rounded-full border px-2 py-0.5 font-semibold", d.state === "approved" ? "border-blue/40 text-blue" : "border-warm/50 text-warm")}>{d.state === "approved" ? "Approved" : "Rejected"}</span>}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {d.options.map((o, i) => (
          <li key={i} className={cn("flex items-start gap-2 rounded border px-3 py-2 text-body-sm", i === d.correct_answer ? "border-blue/50 bg-tint-blue" : "border-line")}>
            {i === d.correct_answer ? <Check aria-label="Correct answer" className="mt-0.5 h-4 w-4 shrink-0 text-blue" /> : <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{o}</span>
          </li>
        ))}
      </ul>
      {d.explanation && <p className="mt-3 text-body-sm text-ink-2"><span className="font-semibold text-ink">Why: </span>{d.explanation}</p>}
      {(d.learning_objective || d.source_reference) && (
        <p className="mt-2 text-caption text-ink-3">
          {d.learning_objective && <>Checks: {d.learning_objective}</>}{d.learning_objective && d.source_reference && " · "}{d.source_reference && <>Source: {d.source_reference}</>}
        </p>
      )}
      {d.flags && d.flags.length > 0 && <ul className="mt-3 space-y-1">{d.flags.map((f, i) => <li key={i} className="flex items-start gap-2 text-caption text-warm"><AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f}</li>)}</ul>}
      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
        <button type="button" onClick={() => onChange({ state: d.state === "approved" ? "pending" : "approved" })} disabled={d.busy} className={cn(btn, d.state === "approved" ? "bg-ink text-canvas" : "border border-line-strong hover:border-ink")}><Check aria-hidden className="h-3.5 w-3.5" />{d.state === "approved" ? "Approved" : "Approve"}</button>
        <button type="button" onClick={() => onChange({ editing: true })} disabled={d.busy} className={cn(btn, "text-ink-2 hover:bg-surface hover:text-ink")}><Pencil aria-hidden className="h-3.5 w-3.5" />Edit</button>
        <button type="button" onClick={onRegenerate} disabled={d.busy} className={cn(btn, "text-ink-2 hover:bg-surface hover:text-ink")}><RefreshCw aria-hidden className={cn("h-3.5 w-3.5", d.busy && "animate-spin")} />{d.busy ? "Regenerating…" : "Regenerate"}</button>
        <button type="button" onClick={() => onChange({ state: d.state === "rejected" ? "pending" : "rejected" })} disabled={d.busy} className={cn(btn, "text-ink-2 hover:bg-surface hover:text-ink")}><X aria-hidden className="h-3.5 w-3.5" />{d.state === "rejected" ? "Undo reject" : "Reject"}</button>
        <button type="button" onClick={onDelete} disabled={d.busy} aria-label={`Delete question ${n}`} className={cn(btn, "ml-auto text-warm hover:bg-warm/10")}><Trash2 aria-hidden className="h-3.5 w-3.5" /></button>
      </div>
    </li>
  );
}
