import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { EnrolForm } from "@/components/admin/EnrolForm";
import { AdminError } from "@/components/admin/AdminStates";
import { setEnrolmentStatus } from "@/app/admin/actions/people";
import { getAdminContext } from "@/lib/admin/guard";
import { personName, type Person } from "@/lib/admin/format";
import { PAGE_SIZE, first, formatDate, isUuid, pageParam } from "@/lib/admin/validation";

export const metadata = { title: "Enrolments" };
type Row = { id: string; user_id: string; course_id: string; status: string; granted_at: string; source: string; courses: { title: string } | null; profiles: Person };

export default async function EnrolmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = first(sp.status), course = first(sp.course), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("enrolments").select("id, user_id, course_id, status, granted_at, source, courses(title), profiles(first_name, last_name, email)", { count: "exact" }).order("granted_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && ["active", "completed", "cancelled", "refunded", "pending"].includes(status)) query = query.eq("status", status);
  if (isUuid(course)) query = query.eq("course_id", course);
  const [{ data, count, error }, { data: courses }] = await Promise.all([query, supabase.from("courses").select("id, title").order("title")]);
  const rows = (data ?? []) as unknown as Row[];

  const prog = new Map<string, number>(), paid = new Map<string, string>();
  if (rows.length) {
    const users = [...new Set(rows.map((r) => r.user_id))];
    const [{ data: pr }, { data: pay }] = await Promise.all([
      supabase.from("course_progress").select("user_id, course_id, percent").in("user_id", users),
      supabase.from("payments").select("user_id, course_id, status, created_at").in("user_id", users).order("created_at", { ascending: false }),
    ]);
    (pr ?? []).forEach((p) => prog.set(`${p.user_id}:${p.course_id}`, Number(p.percent)));
    (pay ?? []).forEach((p) => { const k = `${p.user_id}:${p.course_id}`; if (!paid.has(k)) paid.set(k, p.status as string); });
  }
  const courseOpts = (courses ?? []) as { id: string; title: string }[];

  return (
    <>
      <PageHeader title="Enrolments" subtitle="Who has access to which course. Until Paystack is connected, enrol students here." />
      <Panel title="Enrol a student" className="mb-8"><EnrolForm courses={courseOpts} /></Panel>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FilterSelect param="status" label="Status" options={["active", "completed", "pending", "cancelled", "refunded"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
        <FilterSelect param="course" label="Course" options={courseOpts.map((c) => ({ value: c.id, label: c.title }))} />
      </div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={rows} rowKey={(r) => r.id} empty={{ title: "No enrolments", body: "Enrolments appear here once a student is enrolled." }}
            columns={[
              { key: "s", header: "Student", primary: true, cell: (r) => <Link href={`/admin/students/${r.user_id}`} className="font-medium hover:underline">{personName(r.profiles)}<span className="block text-caption font-normal text-ink-3">{r.profiles?.email}</span></Link> },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "d", header: "Enrolled", cell: (r) => formatDate(r.granted_at) },
              { key: "p", header: "Progress", className: "tabular-nums", cell: (r) => `${prog.get(`${r.user_id}:${r.course_id}`) ?? 0}%` },
              { key: "pay", header: "Payment", cell: (r) => paid.get(`${r.user_id}:${r.course_id}`) ? <StatusBadge status={paid.get(`${r.user_id}:${r.course_id}`)!} /> : <span className="text-ink-3">{r.source === "manual" ? "Manual" : "–"}</span> },
              { key: "a", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.status === "cancelled"
                ? <ActionButton action={setEnrolmentStatus} fields={{ enrolmentId: r.id, to: "active" }} variant="outline" confirm={{ title: "Reactivate this enrolment?", body: "The student regains access.", label: "Reactivate" }}>Reactivate</ActionButton>
                : <ActionButton action={setEnrolmentStatus} fields={{ enrolmentId: r.id, to: "cancelled" }} variant="danger" confirm={{ title: "Cancel this enrolment?", body: "The student loses access. Their progress is kept.", label: "Cancel enrolment" }}>Cancel</ActionButton> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ status, course }} />
        </>
      )}
    </>
  );
}
