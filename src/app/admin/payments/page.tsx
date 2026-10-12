import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { recheckPayment, recordRefund } from "@/app/admin/actions/payments";
import { requirePermission } from "@/lib/admin/guard";
import { personName, type Person } from "@/lib/admin/format";
import { PAGE_SIZE, first, formatDate, formatMoneyMinor, pageParam, safeSearch } from "@/lib/admin/validation";
import { paystackConfigured, paystackMode } from "@/lib/payments/paystack";

export const metadata = { title: "Payments" };
type Row = {
  id: string; reference: string; amount_minor: number; base_amount_minor: number | null; discount_minor: number; currency: string; provider: string; status: string;
  failure_reason: string | null; channel: string | null; created_at: string; verified_at: string | null; courses: { title: string } | null; profiles: Person; coupons: { code: string } | null;
};

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), page = pageParam(sp.page);
  const ctx = await requirePermission("payments");
  if (!ctx) return null;
  let query = ctx.supabase.from("payments")
    .select("id, reference, amount_minor, base_amount_minor, discount_minor, currency, provider, status, failure_reason, channel, created_at, verified_at, courses(title), profiles(first_name, last_name, email), coupons(code)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("reference", `%${q}%`);
  if (status && ["pending", "successful", "failed", "refunded"].includes(status)) query = query.eq("status", status);
  const { data, count, error } = await query;
  const mode = paystackMode();

  return (
    <>
      <PageHeader eyebrow="People" title="Payments" subtitle={<>Written only by the server after Paystack verification. Amounts can&apos;t be edited here. Paystack: {paystackConfigured() ? <strong className="font-semibold">{mode === "live" ? "live mode" : mode === "test" ? "test mode" : "configured"}</strong> : "not configured"}.</>} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><SearchInput placeholder="Search reference" /><FilterSelect param="status" label="Status" options={["pending", "successful", "failed", "refunded"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} /></div>
      {error ? <AdminError title="Unable to load payments" body="Check that migration 0005 has been run, then refresh." /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: q || status ? "No payments match" : "No payments yet", body: q || status ? "Try a different search or filter." : "Payments appear here when students check out." }}
            columns={[
              { key: "r", header: "Reference", primary: true, cell: (r) => <span className="font-medium">{r.reference}</span> },
              { key: "s", header: "Student", cell: (r) => <>{personName(r.profiles)}<span className="block text-caption text-ink-3">{r.profiles?.email}</span></> },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "a", header: "Amount", className: "tabular-nums", cell: (r) => (
                <>{r.provider === "free" ? "Free" : formatMoneyMinor(r.amount_minor, r.currency)}
                  {r.discount_minor > 0 && <span className="block text-caption text-ink-3">{formatMoneyMinor(r.discount_minor, r.currency)} off{r.coupons ? ` · ${r.coupons.code}` : ""}</span>}</>
              ) },
              { key: "st", header: "Status", cell: (r) => <><StatusBadge status={r.status} />{r.failure_reason && <span className="block text-caption text-ink-3">{r.failure_reason.replace(/_/g, " ")}</span>}</> },
              { key: "d", header: "Date", cell: (r) => <>{formatDate(r.created_at, true)}{r.verified_at && <span className="block text-caption text-ink-3">verified {formatDate(r.verified_at, true)}</span>}</> },
              { key: "x", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.status === "pending" && r.provider === "paystack"
                ? <ActionButton action={recheckPayment} fields={{ reference: r.reference }} variant="outline">Re-check</ActionButton>
                : r.status === "successful" && r.provider === "paystack"
                  ? <ActionButton action={recordRefund} fields={{ paymentId: r.id }} variant="danger" confirm={{ title: "Record this payment as refunded?", body: "Do this only after refunding it in the Paystack dashboard. The student loses access to the course.", label: "Record refund" }}>Record refund</ActionButton>
                  : null },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined, status }} />
        </>
      )}
    </>
  );
}
