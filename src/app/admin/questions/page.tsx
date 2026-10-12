import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { reviewQuestion } from "@/app/admin/actions/quizzes";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, isUuid, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Question bank" };
type Row = {
  id: string; question_text: string; question_type: string; difficulty: string | null; review_status: string; published: boolean; archived: boolean; source: string;
  courses: { title: string } | null; lessons: { title: string } | null; quiz_questions: { quiz_id: string }[];
};
const DIFF: Record<string, string> = { easy: "Beginner", medium: "Intermediate", hard: "Advanced" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), page = pageParam(sp.page);
  const course = first(sp.course), mod = first(sp.module), lesson = first(sp.lesson), difficulty = first(sp.difficulty), type = first(sp.type), show = first(sp.show);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("questions")
    .select("id, question_text, question_type, difficulty, review_status, published, archived, source, courses(title), lessons(title), quiz_questions(quiz_id)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("question_text", `%${q}%`);
  if (status && ["draft", "ai_generated", "approved", "rejected"].includes(status)) query = query.eq("review_status", status);
  if (isUuid(course)) query = query.eq("course_id", course);
  if (isUuid(mod)) query = query.eq("module_id", mod);
  if (isUuid(lesson)) query = query.eq("lesson_id", lesson);
  if (difficulty && DIFF[difficulty]) query = query.eq("difficulty", difficulty);
  if (type && ["multiple_choice", "true_false", "multiple_select"].includes(type)) query = query.eq("question_type", type);
  query = query.eq("archived", show === "archived");

  const [{ data, count, error }, { data: courses }, { data: modules }, { data: lessons }] = await Promise.all([
    query,
    supabase.from("courses").select("id, title").order("title"),
    isUuid(course) ? supabase.from("modules").select("id, title").eq("course_id", course).order("position") : Promise.resolve({ data: [] }),
    isUuid(course) ? supabase.from("lessons").select("id, title").eq("course_id", course).order("position").limit(500) : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader title="Question bank" subtitle="Every question in one place, reusable across quizzes. AI drafts wait here for review: nothing reaches students until it's approved, published and in a published quiz."
        actions={<><Link href="/admin/ai/quiz-generator" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink"><Sparkles aria-hidden className="h-4 w-4" />Generate with AI</Link><Link href="/admin/questions/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New question</Link></>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search questions" />
        <FilterSelect param="course" label="Course" options={((courses ?? []) as { id: string; title: string }[]).map((c) => ({ value: c.id, label: c.title }))} />
        {isUuid(course) && <FilterSelect param="module" label="Module" options={((modules ?? []) as { id: string; title: string }[]).map((m) => ({ value: m.id, label: m.title }))} />}
        {isUuid(course) && <FilterSelect param="lesson" label="Lesson" options={((lessons ?? []) as { id: string; title: string }[]).map((l) => ({ value: l.id, label: l.title }))} />}
        <FilterSelect param="difficulty" label="Difficulty" options={Object.entries(DIFF).map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="type" label="Type" options={[{ value: "multiple_choice", label: "Multiple choice" }, { value: "true_false", label: "True / false" }, { value: "multiple_select", label: "Multiple select" }]} />
        <FilterSelect param="status" label="Review" options={[{ value: "ai_generated", label: "AI generated (needs review)" }, { value: "draft", label: "Draft" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }]} />
        <FilterSelect param="show" label="Show" options={[{ value: "archived", label: "Archived" }]} />
      </div>
      {error ? <AdminError title="Unable to load questions" body="Run the latest migration (0003_website_cms.sql), then refresh." /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: q || status || course ? "No questions match" : "No questions yet", body: "Write one, or generate drafts from a lesson with the AI quiz generator.", action: { href: "/admin/ai/quiz-generator", label: "Open the quiz generator" } }}
            columns={[
              { key: "t", header: "Question", primary: true, cell: (r) => <Link href={`/admin/questions/${r.id}`} className="line-clamp-2 font-medium hover:underline">{r.question_text}</Link> },
              { key: "where", header: "Course / lesson", cell: (r) => <span className="text-ink-2">{r.courses?.title ?? "–"}{r.lessons ? ` · ${r.lessons.title}` : ""}</span> },
              { key: "type", header: "Type", cell: (r) => r.question_type.replace("_", " ") },
              { key: "d", header: "Difficulty", cell: (r) => (r.difficulty ? DIFF[r.difficulty] : "–") },
              { key: "rev", header: "Review", cell: (r) => <StatusBadge status={r.review_status} /> },
              { key: "pub", header: "Visible", cell: (r) => <StatusBadge status={r.archived ? "archived" : r.published ? "published" : "draft"} /> },
              { key: "use", header: "Quizzes", className: "tabular-nums", cell: (r) => r.quiz_questions?.length ?? 0 },
              { key: "act", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.review_status === "approved" || r.archived ? null : <ActionButton action={reviewQuestion} fields={{ questionId: r.id, op: "approve" }}>Approve</ActionButton> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status, course, module: mod, lesson, difficulty, type, show }} />
        </>
      )}
    </>
  );
}
