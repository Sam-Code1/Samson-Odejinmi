import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Quizzes" };
type Row = { id: string; title: string; status: string; created_at: string; courses: { title: string } | null; lessons: { title: string } | null; quiz_questions: { count: number }[]; quiz_attempts: { count: number }[] };

export default async function QuizzesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("quizzes").select("id, title, status, created_at, courses(title), lessons(title), quiz_questions(count), quiz_attempts(count)", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (status === "draft" || status === "published") query = query.eq("status", status);
  const { data, count, error } = await query;

  return (
    <>
      <PageHeader title="Quizzes" subtitle="Check understanding with quizzes attached to a course or a lesson." actions={<Link href="/admin/quizzes/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />Create quiz</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><SearchInput placeholder="Search quizzes" /><FilterSelect param="status" label="Status" options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: q || status ? "No quizzes match" : "No quizzes yet", body: "Create a quiz, add questions, then publish it.", action: q || status ? undefined : { href: "/admin/quizzes/new", label: "Create quiz" } }}
            columns={[
              { key: "title", header: "Quiz", primary: true, cell: (r) => <Link href={`/admin/quizzes/${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
              { key: "course", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "lesson", header: "Lesson", cell: (r) => r.lessons?.title ?? "Whole course" },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "qs", header: "Questions", className: "tabular-nums", cell: (r) => r.quiz_questions?.[0]?.count ?? 0 },
              { key: "at", header: "Attempts", className: "tabular-nums", cell: (r) => r.quiz_attempts?.[0]?.count ?? 0 },
              { key: "created", header: "Created", cell: (r) => formatDate(r.created_at) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status }} />
        </>
      )}
    </>
  );
}
