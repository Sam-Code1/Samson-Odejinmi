"use client";

import { useRef, useState, useTransition } from "react";
import { submitQuiz, type QuizResult, type QuizReview } from "@/app/quiz-actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type QuizQuestion = { id: string; text: string; type: "multiple_choice" | "true_false" | "multiple_select"; points: number; options: { id: string; text: string }[] };

export function QuizRunner({ quizId, questions, passMark, canStart }: { quizId: string; questions: QuizQuestion[]; passMark: number; canStart: boolean }) {
  const [res, setRes] = useState<QuizResult | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const result = res?.result;
  const review = new Map<string, QuizReview>((result?.review ?? []).map((r) => [r.question_id, r] as [string, QuizReview]));

  return (
    <div>
      {result && (
        <div role="status" className="mb-10 rounded-lg border border-line bg-elevated p-6">
          <p className="text-caption text-ink-3">Your result</p>
          <p className="mt-1 text-h2">{result.percent}%</p>
          <p className="mt-2 text-body text-ink-2">{result.passed ? "You passed." : `Not quite. The pass mark is ${result.pass_mark}%.`} You scored {result.score} of {result.max} points.</p>
          {result.can_retry && <div className="mt-5"><Button variant="secondary" onClick={() => { setRes(null); form.current?.reset(); window.scrollTo({ top: 0 }); }}>Try again</Button></div>}
        </div>
      )}

      {res && !res.ok && <p role="alert" className="mb-6 border-l-2 border-blue pl-4 text-body-sm">{res.error}</p>}

      <form ref={form} noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => setRes(await submitQuiz(fd))); }} className="space-y-8">
        <input type="hidden" name="quizId" value={quizId} />
        {questions.map((q, i) => {
          const r = review.get(q.id);
          const multi = q.type === "multiple_select";
          return (
            <fieldset key={q.id} disabled={!!result || !canStart} className="rounded-lg border border-line p-5">
              <legend className="px-1 text-caption text-ink-3">Question {i + 1} of {questions.length}{multi ? " · select all that apply" : ""}</legend>
              <p className="text-h4">{q.text}</p>
              <ul className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const correct = r?.correct_option_ids?.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label className={cn("flex cursor-pointer items-start gap-3 rounded border border-line px-4 py-3 text-body-sm transition-colors hover:border-line-strong", correct && "border-blue/60 bg-tint-blue")}>
                        <input type={multi ? "checkbox" : "radio"} name={`q_${q.id}`} value={o.id} className="mt-0.5 h-4 w-4 accent-[rgb(var(--blue))]" />
                        <span>{o.text}{correct && <span className="ml-2 text-caption font-semibold text-blue">Correct answer</span>}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {r && (
                <div className="mt-4 text-body-sm" role="note">
                  <p className={r.is_correct ? "font-semibold text-blue" : "font-semibold text-warm"}>{r.is_correct ? "Correct" : "Not correct"}</p>
                  {r.explanation && <p className="mt-1 text-ink-2">{r.explanation}</p>}
                </div>
              )}
            </fieldset>
          );
        })}
        {!result && canStart && (
          <div className="flex items-center gap-4">
            <Button type="submit" size="lg" disabled={pending}>{pending ? "Submitting…" : "Submit answers"}</Button>
            <span className="text-caption text-ink-3">Pass mark: {passMark}%</span>
          </div>
        )}
      </form>
    </div>
  );
}
