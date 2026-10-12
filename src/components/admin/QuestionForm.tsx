"use client";

import { useState } from "react";
import { saveQuestion } from "@/app/admin/actions/quizzes";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import { useFieldError } from "./FormContext";
import type { OptionRow, QuestionRow } from "@/lib/admin/types";

function OptionsError() {
  const e = useFieldError("options");
  return e ? <p role="alert" className="text-caption text-warm sm:col-span-2">{e}</p> : null;
}

export type LessonOption = { id: string; title: string; course_id: string };

export function QuestionForm({ quizId, question, options, courses, lessons, defaults }: { quizId?: string; question?: QuestionRow; options?: OptionRow[]; courses: { id: string; title: string }[]; lessons: LessonOption[]; defaults?: { course?: string; lesson?: string } }) {
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? "";
  const [type, setType] = useState<string>(question?.question_type ?? "multiple_choice");
  const sorted = [...(options ?? [])].sort((a, b) => a.position - b.position);
  const tfCorrect = sorted.find((o) => o.is_correct)?.option_text?.toLowerCase() === "false" ? "false" : "true";

  return (
    <AdminForm action={saveQuestion} submitLabel={question ? "Save question" : "Create question"}>
      {quizId && <input type="hidden" name="quizId" value={quizId} />}
      {question && <input type="hidden" name="questionId" value={question.id} />}
      <FormSection title="Question">
        <TextAreaInput label="Question text" name="question_text" required rows={3} defaultValue={question?.question_text ?? ""} className="sm:col-span-2" />
        <SelectInput label="Type" name="question_type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "multiple_choice", label: "Multiple choice (one correct)" }, { value: "true_false", label: "True / false" }, { value: "multiple_select", label: "Multiple select (several correct)" }]} />
        <SelectInput label="Difficulty" name="difficulty" defaultValue={question?.difficulty ?? ""} options={[{ value: "", label: "Not set" }, { value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
        <TextInput label="Points" name="points" type="number" min={1} defaultValue={String(question?.points ?? 1)} />
        <SelectInput label="Course" name="course_id" defaultValue={question?.course_id ?? defaults?.course ?? ""} hint={quizId ? "Defaults to the quiz's course." : "Used to find and reuse the question in the bank."}
          options={[{ value: "", label: quizId ? "Same as the quiz" : "Not set" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        <SelectInput label="Lesson" name="lesson_id" defaultValue={question?.lesson_id ?? defaults?.lesson ?? ""} hint="Which lesson this question tests."
          options={[{ value: "", label: "Not set" }, ...lessons.map((l) => ({ value: l.id, label: `${courseTitle(l.course_id)}: ${l.title}` }))]} />
        <TextAreaInput label="Explanation" name="explanation" rows={3} defaultValue={question?.explanation ?? ""} className="sm:col-span-2" hint="Shown after submitting, if the quiz is set to show explanations." />
      </FormSection>

      <FormSection title="Answers">
        {type === "true_false" ? (
          <SelectInput label="Correct answer" name="tf_correct" defaultValue={tfCorrect} options={[{ value: "true", label: "True" }, { value: "false", label: "False" }]} />
        ) : (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`${type}-${i}`} className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <TextInput label={`Option ${i + 1}`} name={`opt_text_${i}`} defaultValue={sorted[i]?.option_text ?? ""} />
                <CheckboxInput label="Correct" name={`opt_correct_${i}`} defaultChecked={sorted[i]?.is_correct ?? false} className="pb-2" />
              </div>
            ))}
            <p className="text-caption text-ink-3 sm:col-span-2">Leave unused options empty. {type === "multiple_choice" ? "Tick exactly one correct answer." : "Tick every correct answer."}</p>
            <OptionsError />
          </>
        )}
      </FormSection>
    </AdminForm>
  );
}
