import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, isUuid, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Lessons" };
type Row = { id: string; title: string; status: string; lesson_type: string; video_provider: string; video_id: string | null; course_id: string; courses: { title: string } | null; modules: { title: string } | null };

export default async function LessonsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), course = first(sp.course), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("lessons").select("id, title, status, lesson_type, video_provider, video_id, course_id, courses(title), modules(title)", { count: "exact" }).order("updated_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (status === "draft" || status === "published") query = query.eq("status", status);
  if (isUuid(course)) query = query.eq("course_id", course);
  const [{ data, count, error }, { data: courses }] = await Promise.all([query, supabase.from("courses").select("id, title").order("title")]);

  return (
    <>
      <PageHeader title="Lessons" subtitle="Every lesson across all courses. To add lessons, open a course's Curriculum tab." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search lessons" />
        <FilterSelect param="status" label="Status" options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} />
        <FilterSelect param="course" label="Course" options={((courses ?? []) as { id: string; title: string }[]).map((c) => ({ value: c.id, label: c.title }))} />
      </div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: "No lessons yet", body: "Add lessons from a course's Curriculum tab.", action: { href: "/admin/courses", label: "Go to courses" } }}
            columns={[
              { key: "t", header: "Lesson", primary: true, cell: (r) => <Link href={`/admin/courses/${r.course_id}/lessons/${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "m", header: "Module", cell: (r) => r.modules?.title ?? "–" },
              { key: "ty", header: "Type", cell: (r) => <span className="capitalize">{r.lesson_type}</span> },
              { key: "v", header: "Video", cell: (r) => r.video_id ? <span className="capitalize">{r.video_provider}</span> : <span className="text-ink-3">None</span> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status, course }} />
        </>
      )}
    </>
  );
}
