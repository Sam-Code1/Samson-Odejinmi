import { createQuiz, saveQuiz } from "@/app/admin/actions/quizzes";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import type { QuizRow } from "@/lib/admin/types";

export function QuizForm({ quiz, courses, lessons, defaults }: { quiz?: QuizRow; courses: { id: string; title: string }[]; lessons: { id: string; title: string; course_id: string }[]; defaults?: { course?: string; lesson?: string } }) {
  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? "";
  return (
    <AdminForm action={quiz ? saveQuiz : createQuiz} submitLabel={quiz ? "Save quiz" : "Create draft quiz"}>
      {quiz && <input type="hidden" name="quizId" value={quiz.id} />}
      <FormSection title="Quiz">
        <TextInput label="Title" name="title" required defaultValue={quiz?.title ?? ""} className="sm:col-span-2" />
        <TextAreaInput label="Description" name="description" rows={2} defaultValue={quiz?.description ?? ""} className="sm:col-span-2" />
        <SelectInput label="Course" name="course_id" required defaultValue={quiz?.course_id ?? defaults?.course ?? ""} options={[{ value: "", label: "Choose a course…" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        <SelectInput label="Attach to lesson (optional)" name="lesson_id" defaultValue={quiz?.lesson_id ?? defaults?.lesson ?? ""} hint="The lesson must be in the chosen course." options={[{ value: "", label: "Whole course" }, ...lessons.map((l) => ({ value: l.id, label: `${courseTitle(l.course_id)}: ${l.title}` }))]} />
      </FormSection>
      <FormSection title="Rules">
        <TextInput label="Pass mark (%)" name="pass_mark" type="number" min={0} max={100} defaultValue={String(quiz?.pass_mark ?? 70)} />
        <TextInput label="Maximum attempts" name="max_attempts" type="number" min={1} defaultValue={quiz?.max_attempts ? String(quiz.max_attempts) : ""} hint="Leave empty for unlimited." />
        <CheckboxInput label="Allow retries" name="allow_retry" defaultChecked={quiz?.allow_retry ?? true} />
        <CheckboxInput label="Show explanations after submitting" name="show_explanations" defaultChecked={quiz?.show_explanations ?? true} />
        {quiz && <SelectInput label="Status" name="status" defaultValue={quiz.status} hint="Students only see published quizzes, and only their approved, published questions." options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />}
      </FormSection>
    </AdminForm>
  );
}
