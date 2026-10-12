"use client";

import { attachQuestions } from "@/app/admin/actions/quizzes";
import { AdminForm } from "./AdminForm";

export type BankQuestion = { id: string; question_text: string; review_status: string; lesson: string | null };

/** Tick questions from the bank to add them to this quiz. Questions are linked, not copied. */
export function AttachQuestionsForm({ quizId, questions }: { quizId: string; questions: BankQuestion[] }) {
  if (!questions.length) return <p className="text-body-sm text-ink-3">No other questions for this course in the bank yet.</p>;
  return (
    <AdminForm action={attachQuestions} submitLabel="Add selected" stickyBar={false}>
      <input type="hidden" name="quizId" value={quizId} />
      <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {questions.map((q) => (
          <li key={q.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 text-body-sm hover:bg-surface">
              <input type="checkbox" name="questionIds" value={q.id} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--blue))]" />
              <span className="min-w-0">
                <span className="line-clamp-2">{q.question_text}</span>
                <span className="text-caption text-ink-3">{q.review_status === "ai_generated" ? "AI draft, needs review" : q.review_status}{q.lesson ? ` · ${q.lesson}` : ""}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </AdminForm>
  );
}
