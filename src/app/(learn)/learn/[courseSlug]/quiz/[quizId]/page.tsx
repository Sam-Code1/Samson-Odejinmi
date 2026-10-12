import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCourse } from "@/lib/learning";
import { isUuid } from "@/lib/admin/validation";
import { QuizRunner, type QuizQuestion } from "@/components/learn/QuizRunner";
import { StateMessage } from "@/components/ui/States";

export const metadata: Metadata = { title: "Quiz", robots: { index: false, follow: false } };

type Payload = { quiz: { id: string; title: string; description: string | null; pass_mark: number; allow_retry: boolean; max_attempts: number | null }; attempts: number; questions: QuizQuestion[] };

export default async function QuizPage({ params }: { params: Promise<{ courseSlug: string; quizId: string }> }) {
  const { courseSlug, quizId } = await params;
  const user = await requireUser(`/learn/${courseSlug}/quiz/${quizId}`);
  const data = await loadCourse(courseSlug, user.id);
  if (data.state !== "ok") return null; // layout explains
  const back = { href: `/learn/${courseSlug}`, label: "Back to the course" };
  if (!isUuid(quizId) || !data.quizzes.some((q) => q.id === quizId)) return <StateMessage title="This quiz isn't available" body="It may not be published yet." action={back} />;

  // The database returns questions WITHOUT correct answers, and only approved + published ones.
  const supabase = await createClient();
  const { data: payload, error } = await supabase.rpc("get_quiz_for_student", { p_quiz: quizId });
  if (error || !payload) return <StateMessage title="This quiz isn't available" body="Try again in a moment." action={back} />;
  const p = payload as Payload;

  const used = p.attempts;
  const out = (!p.quiz.allow_retry && used >= 1) || (p.quiz.max_attempts !== null && used >= p.quiz.max_attempts);

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={`/learn/${courseSlug}`} className="text-label text-ink-3 hover:text-ink"><span className="link-line pb-0.5">{data.course.title}</span></Link>
      <h1 className="mt-4 text-h1">{p.quiz.title}</h1>
      {p.quiz.description && <p className="mt-4 max-w-prose text-body-lg text-ink-2">{p.quiz.description}</p>}
      <p className="mt-3 text-caption text-ink-3">{p.questions.length} {p.questions.length === 1 ? "question" : "questions"} · pass mark {p.quiz.pass_mark}%{p.attempts > 0 ? ` · ${p.attempts} previous ${p.attempts === 1 ? "attempt" : "attempts"}` : ""}</p>
      <div className="mt-10">
        {out && <p role="status" className="mb-6 border-l-2 border-violet pl-4 text-body-sm text-ink-2">You&apos;ve used all your attempts for this quiz.</p>}
        {p.questions.length === 0 ? <p className="text-body text-ink-3">This quiz has no published questions yet.</p> : <QuizRunner quizId={quizId} questions={p.questions} passMark={p.quiz.pass_mark} canStart={!out} />}
      </div>
    </article>
  );
}
