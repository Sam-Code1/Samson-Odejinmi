import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { ResourceUploadForm } from "@/components/admin/ResourceUploadForm";
import { ResourceList } from "@/components/admin/ResourceList";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect } from "@/components/admin/Filters";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, isUuid, pageParam } from "@/lib/admin/validation";
import type { ResourceRow } from "@/lib/admin/types";

export const metadata = { title: "Resources" };
type Opt = { id: string; title: string };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const course = first(sp.course), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("lesson_resources").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (isUuid(course)) query = query.eq("course_id", course);
  const [r, c, m, l, q] = await Promise.all([
    query,
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("modules").select("id, title").order("position").limit(500),
    supabase.from("lessons").select("id, title").order("position").limit(500),
    supabase.from("quizzes").select("id, title").limit(200),
  ]);
  const courses = (c.data ?? []) as Opt[], modules = (m.data ?? []) as Opt[], lessons = (l.data ?? []) as Opt[], quizzes = (q.data ?? []) as Opt[];

  return (
    <>
      <PageHeader title="Resources" subtitle="Downloadable files and links for students: cheat sheets, project files, exercise files. These are separate from lesson videos, which are always view-only." />
      <Panel title="Add a resource" className="mb-8"><ResourceUploadForm courses={courses} modules={modules} lessons={lessons} quizzes={quizzes} /></Panel>
      <div className="mb-5"><FilterSelect param="course" label="Course" options={courses.map((x) => ({ value: x.id, label: x.title }))} /></div>
      {r.error ? <AdminError /> : (
        <>
          <Panel><ResourceList resources={(r.data ?? []) as unknown as ResourceRow[]} lessons={lessons} modules={modules} quizzes={quizzes} /></Panel>
          <Pagination page={page} pageSize={PAGE_SIZE} total={r.count ?? 0} params={{ course }} />
        </>
      )}
    </>
  );
}
