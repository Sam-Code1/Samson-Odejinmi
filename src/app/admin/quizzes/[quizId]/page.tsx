import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { QuizForm } from "@/components/admin/QuizForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminEmpty } from "@/components/admin/AdminStates";
import { AttachQuestionsForm, type BankQuestion } from "@/components/admin/AttachQuestionsForm";
import { deleteQuiz, detachQuestion, moveQuizQuestion, reviewQuestion } from "@/app/admin/actions/quizzes";
import { getAdminContext } from "@/lib/admin/guard";
import { formatDate, isUuid } from "@/lib/admin/validation";
import type { QuestionRow, QuizRow } from "@/lib/admin/types";

export const metadata = { title: "Edit quiz" };
type Attempt = { id: string; percent: number; passed: boolean; submitted_at: string; profiles: { first_name: string; last_name: string; email: string | null } | null };

export default async function QuizPage({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = await params;
  if (!isUuid(quizId)) notFound();
  const { supabase } = (await getAdminContext())!;
  const [{ data: quizRaw }, { data: links }, { data: att }, { data: courses }, { data: lessons }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(),
    supabase.from("quiz_questions").select("position, questions(*)").eq("quiz_id", quizId).order("position").order("created_at"),
    supabase.from("quiz_attempts").select("id, percent, passed, submitted_at, profiles(first_name, last_name, email)").eq("quiz_id", quizId).order("submitted_at", { ascending: false }).limit(25),
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("lessons").select("id, title, course_id").order("position").limit(1000),
  ]);
  if (!quizRaw) notFound();
  const quiz = quizRaw as unknown as QuizRow;
  const questions = ((links ?? []) as unknown as { questions: QuestionRow | null }[]).map((l) => l.questions).filter(Boolean) as QuestionRow[];
  const attempts = (att ?? []) as unknown as Attempt[];
  const needsReview = questions.filter((q) => q.review_status === "ai_generated").length;
  const live = questions.filter((q) => q.published && q.review_status === "approved" && !q.archived).length;

  const { data: bank } = await supabase.from("questions").select("id, question_text, review_status, lessons(title)").eq("course_id", quiz.course_id).eq("archived", false).neq("review_status", "rejected").order("created_at", { ascending: false }).limit(200);
  const attached = new Set(questions.map((q) => q.id));
  const available: BankQuestion[] = ((bank ?? []) as unknown as { id: string; question_text: string; review_status: string; lessons: { title: string } | null }[])
    .filter((b) => !attached.has(b.id)).map((b) => ({ id: b.id, question_text: b.question_text, review_status: b.review_status, lesson: b.lessons?.title ?? null }));
  const gen = `/admin/ai/quiz-generator?course=${quiz.course_id}${quiz.lesson_id ? `&lesson=${quiz.lesson_id}` : ""}&quiz=${quizId}`;

  return (
    <>
      <PageHeader eyebrow="Quiz" title={quiz.title} subtitle={<Link href="/admin/quizzes" className="underline underline-offset-4">All quizzes</Link>} actions={<StatusBadge status={quiz.status} />} />
      <div className="grid gap-8 xl:grid-cols-[1fr_28rem]">
        <QuizForm quiz={quiz} courses={(courses ?? []) as { id: string; title: string }[]} lessons={(lessons ?? []) as { id: string; title: string; course_id: string }[]} />

        <div className="space-y-6">
          <Panel title={`Questions (${questions.length})`} description={`${live} visible to students. Order here is the order students see.`}
            actions={<Link href={`/admin/questions/new?quiz=${quizId}`} className="inline-flex items-center gap-1 text-caption font-semibold text-blue"><Plus aria-hidden className="h-3.5 w-3.5" />Write one</Link>}>
            {needsReview > 0 && <p className="mb-4 rounded border border-violet/40 px-3 py-2 text-caption text-ink-2">{needsReview} AI-generated {needsReview === 1 ? "question needs" : "questions need"} your review. Nothing reaches students until you approve and publish it.</p>}
            {questions.length === 0 ? <AdminEmpty title="No questions yet" body="Write one, add from the bank below, or generate drafts with AI." /> : (
              <ol className="divide-y divide-line">
                {questions.map((q, i) => (
                  <li key={q.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <p className="text-body-sm font-medium"><span className="mr-2 tabular-nums text-ink-3">{i + 1}.</span>{q.question_text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={q.review_status} />
                      <StatusBadge status={q.archived ? "archived" : q.published ? "published" : "draft"} />
                      <span className="text-caption text-ink-3">{q.question_type.replace("_", " ")} · {q.points} pt</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <ActionButton action={moveQuizQuestion} fields={{ quizId, questionId: q.id, dir: "up" }} ariaLabel="Move question up" disabled={i === 0}><ArrowUp aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <ActionButton action={moveQuizQuestion} fields={{ quizId, questionId: q.id, dir: "down" }} ariaLabel="Move question down" disabled={i === questions.length - 1}><ArrowDown aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                      <Link href={`/admin/questions/${q.id}`} className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-caption font-semibold text-ink-2 hover:bg-surface hover:text-ink"><Pencil aria-hidden className="h-3.5 w-3.5" />Edit</Link>
                      {q.review_status !== "approved" && <ActionButton action={reviewQuestion} fields={{ questionId: q.id, op: "approve" }}>Approve</ActionButton>}
                      {q.review_status === "approved" && !q.archived && (q.published ? <ActionButton action={reviewQuestion} fields={{ questionId: q.id, op: "unpublish" }}>Unpublish</ActionButton> : <ActionButton action={reviewQuestion} fields={{ questionId: q.id, op: "publish" }}>Publish</ActionButton>)}
                      <ActionButton action={detachQuestion} fields={{ quizId, questionId: q.id }} ariaLabel="Remove from this quiz" title="Remove from this quiz (keeps it in the bank)"><X aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Add from the question bank" description="Linked, not copied: edit once, it updates everywhere.">
            <AttachQuestionsForm quizId={quizId} questions={available} />
          </Panel>

          <Panel title="AI question drafts">
            <p className="text-body-sm text-ink-2">Generate draft questions from this quiz&apos;s lesson. You review, edit and approve each one; nothing is published automatically.</p>
            <Link href={gen} className="mt-4 inline-flex h-9 items-center gap-2 rounded border border-line-strong px-3 text-label hover:border-ink"><Sparkles aria-hidden className="h-4 w-4" />Open the quiz generator</Link>
          </Panel>

          <Panel title="Danger zone">
            <ActionButton action={deleteQuiz} fields={{ quizId }} variant="danger" className="h-9 px-3" confirm={{ title: `Delete “${quiz.title}”?`, body: "The quiz and all student attempts are deleted permanently. Its questions stay in the bank.", label: "Delete quiz" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete quiz</ActionButton>
          </Panel>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-admin-section">Recent attempts</h2>
        <DataTable<Attempt> rows={attempts} rowKey={(a) => a.id} empty={{ title: "No attempts yet", body: "Student attempts appear here after they submit this quiz." }}
          columns={[
            { key: "s", header: "Student", primary: true, cell: (a) => a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}`.trim() || a.profiles.email || "Student" : "Deleted user" },
            { key: "e", header: "Email", cell: (a) => a.profiles?.email ?? "–" },
            { key: "p", header: "Score", className: "tabular-nums", cell: (a) => `${a.percent}%` },
            { key: "r", header: "Result", cell: (a) => <StatusBadge status={a.passed ? "passed" : "not_passed"} /> },
            { key: "d", header: "Submitted", cell: (a) => formatDate(a.submitted_at, true) },
          ]} />
      </section>
    </>
  );
}
