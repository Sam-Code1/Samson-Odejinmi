import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { Pagination } from "@/components/admin/Pagination";
import { requirePermission } from "@/lib/admin/guard";
import { first, formatDate, PAGE_SIZE } from "@/lib/admin/validation";
import { LIFECYCLES } from "@/lib/marketing/segments";
import { cleanTag } from "@/lib/marketing/steps";

export const metadata = { title: "Customers" };
type Row = { id: string; email: string; name: string | null; lifecycle: string; orders: number; marketing_consent: boolean; unsubscribed_at: string | null; source: string | null; tags: string[] | null; created_at: string; user_id: string | null };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("customers");
  if (!ctx) return null;
  const sp = await searchParams;
  const qText = first(sp.q)?.slice(0, 80), lifecycle = first(sp.lifecycle), consent = first(sp.consent), tag = cleanTag(first(sp.tag) ?? "");
  const page = Math.max(1, Number(first(sp.page)) || 1);
  let q = ctx.supabase.from("customer_overview").select("id, email, name, lifecycle, orders, marketing_consent, unsubscribed_at, source, tags, created_at, user_id", { count: "exact" }).order("created_at", { ascending: false });
  if (qText) q = q.or(`email.ilike.%${qText.replace(/[%,()]/g, "")}%,name.ilike.%${qText.replace(/[%,()]/g, "")}%`);
  if (lifecycle && lifecycle in LIFECYCLES) q = q.eq("lifecycle", lifecycle);
  if (consent === "yes") q = q.eq("marketing_consent", true).is("unsubscribed_at", null);
  if (consent === "no") q = q.or("marketing_consent.eq.false,unsubscribed_at.not.is.null");
  if (tag) q = q.contains("tags", [tag]);
  const { data, error, count } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Customers" subtitle="Everyone who has an account, bought something or subscribed: one record per email address, linked to their account. Personal data: visible only to roles with customer access." />
      <div className="mb-5 flex flex-wrap gap-3">
        <SearchInput placeholder="Search name or email" />
        <FilterSelect param="lifecycle" label="Lifecycle" options={Object.entries(LIFECYCLES).map(([value, label]) => ({ value, label }))} />
        <FilterSelect param="consent" label="Marketing" options={[{ value: "yes", label: "Opted in" }, { value: "no", label: "Not opted in" }]} />
      </div>
      {tag && <p className="mb-4 text-body-sm">Tag: <strong>{tag}</strong> · <Link href="/admin/marketing/customers" className="underline underline-offset-4">clear</Link></p>}
      {error ? <AdminError title="Customers need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as Row[]} rowKey={(r) => r.id}
            empty={{ title: qText || lifecycle || consent || tag ? "No one matches" : "No customers yet", body: "People appear here when they create an account, buy something or subscribe." }}
            columns={[
              { key: "n", header: "Customer", primary: true, cell: (r) => <div className="min-w-0"><Link href={`/admin/marketing/customers/${r.id}`} className="font-semibold hover:underline">{r.name || r.email}</Link>{r.name && <p className="truncate text-caption text-ink-3">{r.email}</p>}</div> },
              { key: "l", header: "Lifecycle", cell: (r) => <StatusBadge status={r.lifecycle} /> },
              { key: "o", header: "Orders", className: "tabular-nums", cell: (r) => r.orders },
              { key: "c", header: "Marketing", cell: (r) => (r.marketing_consent && !r.unsubscribed_at ? "Opted in" : r.unsubscribed_at ? "Unsubscribed" : "No") },
              { key: "t", header: "Tags", hideOnMobile: true, cell: (r) => (r.tags?.length ? <span className="flex flex-wrap justify-end gap-1 md:justify-start">{r.tags.slice(0, 4).map((t) => <Link key={t} href={`?tag=${t}`} className="rounded-full border border-line px-2 py-0.5 text-meta hover:border-ink">{t}</Link>)}</span> : "–") },
              { key: "d", header: "Since", hideOnMobile: true, cell: (r) => formatDate(r.created_at) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: qText, lifecycle, consent, tag: tag ?? undefined }} />
        </>
      )}
    </>
  );
}
