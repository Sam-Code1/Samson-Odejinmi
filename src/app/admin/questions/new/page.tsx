import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { QuestionForm, type LessonOption } from "@/components/admin/QuestionForm";
import { getAdminContext } from "@/lib/admin/guard";
import { first, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "New question" };

/** With ?quiz=… the question is created and attached to that quiz. Without it, it goes into the bank only. */
export default async function NewQuestion({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const quizId = first(sp.quiz);
  const { supabase } = (await getAdminContext())!;
  const [{ data: quiz }, { data: courses }, { data: lessons }] = await Promise.all([
    isUuid(quizId) ? supabase.from("quizzes").select("title, course_id, lesson_id").eq("id", quizId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("lessons").select("id, title, course_id").order("position").limit(1000),
  ]);
  const q = quiz as { title: string; course_id: string; lesson_id: string | null } | null;
  return (
    <>
      <PageHeader eyebrow={q?.title ?? "Question bank"} title="New question"
        subtitle={q ? <Link href={`/admin/quizzes/${quizId}`} className="underline underline-offset-4">Back to quiz</Link> : <Link href="/admin/questions" className="underline underline-offset-4">Question bank</Link>} />
      <div className="max-w-3xl">
        <QuestionForm quizId={q ? quizId : undefined} courses={(courses ?? []) as { id: string; title: string }[]} lessons={(lessons ?? []) as LessonOption[]}
          defaults={{ course: q?.course_id ?? first(sp.course), lesson: q?.lesson_id ?? first(sp.lesson) }} />
      </div>
    </>
  );
}
