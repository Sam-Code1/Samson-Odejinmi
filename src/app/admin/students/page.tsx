import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Students" };
type Row = { id: string; first_name: string; last_name: string; email: string | null; created_at: string; last_active_at: string | null };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), sort = first(sp.sort) ?? "joined", filter = first(sp.filter), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;

  // Pagination keeps this fast: we only ever load one page of students.
  let query = supabase.from("profiles").select("id, first_name, last_name, email, created_at, last_active_at", { count: "exact" });
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  query = sort === "active" ? query.order("last_active_at", { ascending: false, nullsFirst: false }) : sort === "name" ? query.order("first_name") : query.order("created_at", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];

  const counts = new Map<string, number>();
  if (rows.length) {
    const { data: en } = await supabase.from("enrolments").select("user_id").in("user_id", rows.map((r) => r.id)).in("status", ["active", "completed"]);
    (en ?? []).forEach((e) => counts.set(e.user_id as string, (counts.get(e.user_id as string) ?? 0) + 1));
  }
  const shown = filter === "enrolled" ? rows.filter((r) => counts.get(r.id)) : filter === "none" ? rows.filter((r) => !counts.get(r.id)) : rows;

  return (
    <>
      <PageHeader title="Students" subtitle="Everyone who has registered. Open a student to see their enrolments, progress and quiz results." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search name or email" />
        <FilterSelect param="filter" label="Show" options={[{ value: "enrolled", label: "Enrolled" }, { value: "none", label: "Not enrolled" }]} />
        <FilterSelect param="sort" label="Sort" options={[{ value: "joined", label: "Newest" }, { value: "active", label: "Last active" }, { value: "name", label: "Name" }]} />
      </div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={shown} rowKey={(r) => r.id}
            empty={{ title: q ? "No students match" : "No students yet", body: q ? "Try a different search." : "Students appear here after they create an account." }}
            columns={[
              { key: "n", header: "Name", primary: true, cell: (r) => <Link href={`/admin/students/${r.id}`} className="font-medium hover:underline">{`${r.first_name} ${r.last_name}`.trim() || "Unnamed"}</Link> },
              { key: "e", header: "Email", cell: (r) => r.email ?? "–" },
              { key: "c", header: "Courses", className: "tabular-nums", cell: (r) => counts.get(r.id) ?? 0 },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={counts.get(r.id) ? "enrolled" : "not_enrolled"} /> },
              { key: "j", header: "Joined", cell: (r) => formatDate(r.created_at) },
              { key: "a", header: "Last active", cell: (r) => formatDate(r.last_active_at) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, sort, filter }} />
        </>
      )}
    </>
  );
}
