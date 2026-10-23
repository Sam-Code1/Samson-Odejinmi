import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { FilterSelect } from "@/components/admin/Filters";
import { requirePermission } from "@/lib/admin/guard";
import { first, formatDate, formatMoneyMinor } from "@/lib/admin/validation";
import { TYPE_LABELS, type ProductType } from "@/lib/products";

export const metadata = { title: "Products" };
type Row = { id: string; name: string; slug: string; product_type: ProductType; status: string; updated_at: string; courses: { title: string } | null; product_prices: { currency: string; amount_minor: number }[] };

export default async function ProductsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const sp = await searchParams;
  const status = first(sp.status), type = first(sp.type);
  let q = ctx.supabase.from("products").select("id, name, slug, product_type, status, updated_at, courses(title), product_prices(currency, amount_minor)").order("updated_at", { ascending: false });
  if (status && ["draft", "published", "archived"].includes(status)) q = q.eq("status", status); else q = q.neq("status", "archived");
  if (type && type in TYPE_LABELS) q = q.eq("product_type", type);
  const { data, error } = await q;

  return (
    <>
      <PageHeader eyebrow="Sales" title="Products" subtitle="Ebooks, guides, templates, downloads, bundles and course products. Prices and files are read by the server at checkout and download; nothing in the browser can change them."
        actions={<><Link href="/admin/products/shop" className="inline-flex h-10 items-center rounded border border-line-strong px-4 text-label hover:border-ink">Books settings</Link><Link href="/admin/products/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New product</Link></>} />
      <div className="mb-5 flex flex-wrap gap-3">
        <FilterSelect param="status" label="Status" options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
        <FilterSelect param="type" label="Type" options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      {error ? <AdminError title="Products need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql in the Supabase SQL editor, then refresh." /> : (
        <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
          empty={{ title: status || type ? "No products match" : "No products yet", body: "Create your first ebook, guide or bundle. It stays a draft until you publish it.", action: { href: "/admin/products/new", label: "Create a product" } }}
          columns={[
            { key: "n", header: "Product", primary: true, cell: (r) => <div className="min-w-0"><Link href={`/admin/products/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><p className="truncate text-caption text-ink-3">/academy/books/{r.slug}</p></div> },
            { key: "t", header: "Type", cell: (r) => <>{TYPE_LABELS[r.product_type]}{r.courses ? <span className="block text-caption text-ink-3">{r.courses.title}</span> : null}</> },
            { key: "p", header: "Price", className: "tabular-nums", cell: (r) => r.product_type === "course" ? <span className="text-ink-3">Course pricing</span> : r.product_prices.length ? r.product_prices.map((p) => formatMoneyMinor(p.amount_minor, p.currency)).join(" · ") : <span className="text-warm">Not set</span> },
            { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { key: "u", header: "Updated", hideOnMobile: true, cell: (r) => formatDate(r.updated_at) },
          ]} />
      )}
    </>
  );
}
