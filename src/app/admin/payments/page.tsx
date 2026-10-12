import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import { personName, type Person } from "@/lib/admin/format";
import { PAGE_SIZE, first, formatDate, formatMoneyMinor, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Payments" };
type Row = { id: string; reference: string; amount_minor: number; currency: string; provider: string; status: string; created_at: string; courses: { title: string } | null; profiles: Person };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let query = supabase.from("payments").select("id, reference, amount_minor, currency, provider, status, created_at, courses(title), profiles(first_name, last_name, email)", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("reference", `%${q}%`);
  if (status && ["pending", "successful", "failed", "refunded"].includes(status)) query = query.eq("status", status);
  const { data, count, error } = await query;

  return (
    <>
      <PageHeader title="Payments" subtitle="Read-only. Payments are recorded by the server after Paystack verification, never from the browser." />
      <div className="mb-5 flex flex-wrap items-center gap-3"><SearchInput placeholder="Search reference" /><FilterSelect param="status" label="Status" options={["pending", "successful", "failed", "refunded"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: q || status ? "No payments match" : "No payments yet", body: q || status ? "Try a different search or filter." : "Payments will appear here once Paystack is connected and a student pays." }}
            columns={[
              { key: "r", header: "Reference", primary: true, cell: (r) => <span className="font-medium">{r.reference}</span> },
              { key: "s", header: "Student", cell: (r) => <>{personName(r.profiles)}<span className="block text-caption text-ink-3">{r.profiles?.email}</span></> },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "a", header: "Amount", className: "tabular-nums", cell: (r) => formatMoneyMinor(r.amount_minor, r.currency) },
              { key: "p", header: "Provider", cell: (r) => <span className="capitalize">{r.provider}</span> },
              { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              { key: "d", header: "Date", cell: (r) => formatDate(r.created_at, true) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status }} />
        </>
      )}
    </>
  );
}
