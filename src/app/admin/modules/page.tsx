import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { AdminError } from "@/components/admin/AdminStates";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, isUuid, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Modules" };
type Row = { id: string; title: string; position: number; status?: string; course_id: string; courses: { title: string } | null; lessons: { count: number }[] };

export default async function ModulesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), course = first(sp.course), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("modules").select("id, title, position, status, course_id, courses(title), lessons(count)", { count: "exact" }).order("course_id").order("position").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (isUuid(course)) query = query.eq("course_id", course);
  const [{ data, count, error }, { data: courses }] = await Promise.all([query, supabase.from("courses").select("id, title").order("title")]);

  return (
    <>
      <PageHeader title="Modules" subtitle="Every module across all courses. To reorder or add modules, open the course's Curriculum tab." />
      <div className="mb-5 flex flex-wrap items-center gap-3"><SearchInput placeholder="Search modules" /><FilterSelect param="course" label="Course" options={((courses ?? []) as { id: string; title: string }[]).map((c) => ({ value: c.id, label: c.title }))} /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: "No modules yet", body: "Create a course, then add modules in its Curriculum tab.", action: { href: "/admin/courses", label: "Go to courses" } }}
            columns={[
              { key: "t", header: "Module", primary: true, cell: (r) => <Link href={`/admin/courses/${r.course_id}/modules/${r.id}`} className="font-medium hover:underline">{r.title}</Link> },
              { key: "c", header: "Course", cell: (r) => <Link href={`/admin/courses/${r.course_id}?tab=curriculum`} className="hover:underline">{r.courses?.title ?? "–"}</Link> },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status ?? "published"} /> },
              { key: "p", header: "Order", className: "tabular-nums", cell: (r) => r.position },
              { key: "l", header: "Lessons", className: "tabular-nums", cell: (r) => r.lessons?.[0]?.count ?? 0 },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, course }} />
        </>
      )}
    </>
  );
}
