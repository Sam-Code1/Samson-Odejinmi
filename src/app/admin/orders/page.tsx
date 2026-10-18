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
import { PROVIDERS, isProviderId } from "@/lib/payments/providers";

export const metadata = { title: "Orders" };
type Row = {
  id: string; order_number: string | null; reference: string; amount_minor: number; discount_minor: number; currency: string; provider: string; status: string; failure_reason: string | null;
  created_at: string; paid_at: string | null; user_id: string | null; guest_email: string | null; customer_name: string | null;
  profiles: Person; courses: { title: string } | null; products: { name: string } | null; payment_items: { name: string }[] | null;
};

/**
 * Every order from both storefronts (guest and account). Read-only amounts; status changes only through provider
 * verification, "Re-check" (asks the provider) or "Record refund" (after refunding in the provider's dashboard).
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? ""), status = first(sp.status), provider = first(sp.provider), currency = first(sp.currency), buyer = first(sp.buyer), page = pageParam(sp.page);
  const ctx = await requirePermission("payments");
  if (!ctx) return null;
  let query = ctx.supabase.from("payments")
    .select("id, order_number, reference, amount_minor, discount_minor, currency, provider, status, failure_reason, created_at, paid_at, user_id, guest_email, customer_name, profiles(first_name, last_name, email), courses(title), products(name), payment_items(name)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.or(`order_number.ilike.%${q}%,reference.ilike.%${q}%,guest_email.ilike.%${q}%`);
  if (status && ["pending", "successful", "failed", "refunded"].includes(status)) query = query.eq("status", status);
  if (provider && (isProviderId(provider) || provider === "free")) query = query.eq("provider", provider);
  if (currency && /^[A-Z]{3}$/.test(currency)) query = query.eq("currency", currency);
  if (buyer === "guest") query = query.is("user_id", null).not("guest_email", "is", null);
  if (buyer === "account") query = query.not("user_id", "is", null);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  // Downloads per order on this page.
  const { data: dl } = rows.length ? await ctx.supabase.from("product_downloads").select("payment_id").in("payment_id", rows.map((r) => r.id)) : { data: [] };
  const downloads = new Map<string, number>();
  for (const d of (dl ?? []) as { payment_id: string }[]) downloads.set(d.payment_id, (downloads.get(d.payment_id) ?? 0) + 1);
  const params = { q: q || undefined, status, provider, currency, buyer };

  return (
    <>
      <PageHeader eyebrow="Sales" title="Orders" subtitle="Every order from the main-site shop and the Academy, from guests and account holders. Amounts are set by the database at checkout and confirmed with the payment provider; they can't be edited here." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Order number, reference or email" />
        <FilterSelect param="status" label="Status" options={["pending", "successful", "failed", "refunded"].map((s) => ({ value: s, label: s === "successful" ? "Paid" : s[0].toUpperCase() + s.slice(1) }))} />
        <FilterSelect param="buyer" label="Buyer" options={[{ value: "guest", label: "Guest" }, { value: "account", label: "Account" }]} />
        <FilterSelect param="provider" label="Provider" options={[...Object.values(PROVIDERS).map((p) => ({ value: p.id, label: p.name })), { value: "free", label: "Free" }]} />
        <FilterSelect param="currency" label="Currency" options={["NGN", "USD", "GBP"].map((c) => ({ value: c, label: c }))} />
      </div>
      {error ? <AdminError title="Orders need migration 0013" body="Run supabase/migrations/0013_guest_commerce.sql in the Supabase SQL editor, then refresh. Until then, see Payments." /> : (
        <>
          <DataTable<Row> rows={rows} rowKey={(r) => r.id}
            empty={{ title: Object.values(params).some(Boolean) ? "No orders match" : "No orders yet", body: Object.values(params).some(Boolean) ? "Try a different search or filter." : "Orders appear here when people check out." }}
            columns={[
              { key: "o", header: "Order", primary: true, cell: (r) => <><span className="font-medium">{r.order_number ?? r.reference}</span><span className="block text-caption text-ink-3">{r.reference}</span></> },
              { key: "c", header: "Customer", cell: (r) => r.user_id
                ? <>{personName(r.profiles)}<span className="block text-caption text-ink-3">{r.profiles?.email} · Account</span></>
                : <>{r.customer_name ?? "Guest"}<span className="block break-all text-caption text-ink-3">{r.guest_email ?? "–"} · Guest</span></> },
              { key: "i", header: "Items", cell: (r) => {
                const names = r.payment_items?.length ? r.payment_items.map((i) => i.name) : [r.products?.name ?? r.courses?.title ?? "–"];
                return <span className="line-clamp-2">{names.join(", ")}</span>;
              } },
              { key: "a", header: "Amount", className: "tabular-nums", cell: (r) => <>{r.provider === "free" ? "Free" : formatMoneyMinor(r.amount_minor, r.currency)}<span className="block text-caption text-ink-3">{r.currency}{r.discount_minor > 0 ? ` · ${formatMoneyMinor(r.discount_minor, r.currency)} off` : ""}</span></> },
              { key: "p", header: "Provider", cell: (r) => (isProviderId(r.provider) ? PROVIDERS[r.provider].name : r.provider === "free" ? "Free" : r.provider) },
              { key: "s", header: "Status", cell: (r) => <><StatusBadge status={r.status} />{r.failure_reason && <span className="block text-caption text-ink-3">{r.failure_reason.replace(/_/g, " ")}</span>}</> },
              { key: "d", header: "Dates", cell: (r) => <>{formatDate(r.created_at, true)}{r.paid_at && <span className="block text-caption text-ink-3">paid {formatDate(r.paid_at, true)}</span>}</> },
              { key: "dl", header: "Downloads", className: "tabular-nums", hideOnMobile: true, cell: (r) => downloads.get(r.id) ?? 0 },
              { key: "x", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.status === "pending" && isProviderId(r.provider)
                ? <ActionButton action={recheckPayment} fields={{ reference: r.reference }} variant="outline">Re-check</ActionButton>
                : r.status === "successful" && isProviderId(r.provider)
                  ? <ActionButton action={recordRefund} fields={{ paymentId: r.id }} variant="danger" confirm={{ title: "Record this order as refunded?", body: "Do this only after refunding it in the payment provider's dashboard. The buyer loses access and downloads stop. The order record is kept.", label: "Record refund" }}>Record refund</ActionButton>
                  : null },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={params} />
        </>
      )}
    </>
  );
}
