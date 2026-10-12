import { PageHeader } from "@/components/admin/PageHeader";
import { QuizForm } from "@/components/admin/QuizForm";
import { getAdminContext } from "@/lib/admin/guard";
import { first } from "@/lib/admin/validation";

export const metadata = { title: "Create quiz" };

export default async function NewQuiz({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = (await getAdminContext())!;
  const [c, l] = await Promise.all([supabase.from("courses").select("id, title").order("title"), supabase.from("lessons").select("id, title, course_id").order("position").limit(500)]);
  return (
    <>
      <PageHeader eyebrow="Quizzes" title="Create quiz" subtitle="New quizzes start as drafts. Add questions next." />
      <div className="max-w-3xl"><QuizForm courses={(c.data ?? []) as { id: string; title: string }[]} lessons={(l.data ?? []) as { id: string; title: string; course_id: string }[]} defaults={{ course: first(sp.course), lesson: first(sp.lesson) }} /></div>
    </>
  );
}
