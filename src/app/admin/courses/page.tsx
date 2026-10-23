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

export const metadata = { title: "Courses" };
type Row = { id: string; title: string; slug: string; status: string; level: string | null; updated_at: string; modules: { count: number }[]; lessons: { count: number }[] };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? "");
  const status = first(sp.status);
  const page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;

  let query = supabase.from("courses").select("id, title, slug, status, level, updated_at, modules(count), lessons(count)", { count: "exact" }).order("updated_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  if (status && ["draft", "coming_soon", "published", "archived"].includes(status)) query = query.eq("status", status);
  const { data, count, error } = await query;

  return (
    <>
      <PageHeader title="Courses" subtitle="Create, edit and publish the courses in your Academy." actions={<Link href="/admin/courses/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />Create course</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><SearchInput placeholder="Search courses" /><FilterSelect param="status" label="Status" options={[{ value: "draft", label: "Draft" }, { value: "coming_soon", label: "Coming soon" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }]} /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row>
            rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: q || status ? "No courses match" : "No courses yet", body: q || status ? "Try a different search or filter." : "Create your first course to start building your Academy.", action: q || status ? undefined : { href: "/admin/courses/new", label: "Create course" } }}
            columns={[
              { key: "title", header: "Course", primary: true, cell: (r) => <Link href={`/admin/courses/${r.id}`} className="font-medium hover:underline">{r.title}<span className="block text-caption font-normal text-ink-3">/{r.slug}</span></Link> },
              { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "level", header: "Level", cell: (r) => r.level ?? "–" },
              { key: "modules", header: "Modules", className: "tabular-nums", cell: (r) => r.modules?.[0]?.count ?? 0 },
              { key: "lessons", header: "Lessons", className: "tabular-nums", cell: (r) => r.lessons?.[0]?.count ?? 0 },
              { key: "updated", header: "Updated", cell: (r) => formatDate(r.updated_at) },
              { key: "edit", header: "", className: "text-right", hideOnMobile: true, cell: (r) => <Link href={`/admin/courses/${r.id}`} className="text-label text-blue hover:underline">Edit</Link> },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status }} />
        </>
      )}
    </>
  );
}
