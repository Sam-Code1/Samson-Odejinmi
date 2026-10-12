import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { setCertificateRevoked } from "@/app/admin/actions/people";
import { getAdminContext } from "@/lib/admin/guard";
import { personName, type Person } from "@/lib/admin/format";
import { PAGE_SIZE, first, formatDate, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Certificates" };
type Row = { id: string; certificate_number: string; issued_at: string; completed_at: string | null; revoked: boolean; courses: { title: string } | null; profiles: Person };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? "").toUpperCase(), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("certificates").select("id, certificate_number, issued_at, completed_at, revoked, courses(title), profiles(first_name, last_name, email)", { count: "exact" }).order("issued_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("certificate_number", `%${q}%`);
  const { data, count, error } = await query;

  return (
    <>
      <PageHeader title="Certificates" subtitle="Issued automatically when a student completes 100% of a course that has certificates turned on (Course → Publishing)." />
      <div className="mb-5"><SearchInput placeholder="Search certificate number" /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: "No certificates yet", body: "They appear here after students complete a course with certificates enabled.", action: { href: "/admin/courses", label: "Go to courses" } }}
            columns={[
              { key: "n", header: "Number", primary: true, cell: (r) => <Link href={`/certificate/${r.certificate_number}`} className="font-medium hover:underline">{r.certificate_number}</Link> },
              { key: "s", header: "Student", cell: (r) => personName(r.profiles) },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "d", header: "Issued", cell: (r) => formatDate(r.issued_at) },
              { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.revoked ? "revoked" : "valid"} /> },
              { key: "a", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.revoked
                ? <ActionButton action={setCertificateRevoked} fields={{ certificateId: r.id, revoked: "no" }} variant="outline">Restore</ActionButton>
                : <ActionButton action={setCertificateRevoked} fields={{ certificateId: r.id, revoked: "yes" }} variant="danger" confirm={{ title: "Revoke this certificate?", body: "Its public verification page will show it as no longer valid.", label: "Revoke" }}>Revoke</ActionButton> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined }} />
        </>
      )}
    </>
  );
}
