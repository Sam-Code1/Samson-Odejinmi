import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { BundleItemsForm, ProductDetailsForm, ProductPricesForm, RelatedProductsForm, type ProductRow } from "@/components/admin/ProductForms";
import { ProductFileUpload } from "@/components/admin/ProductFileUpload";
import { requirePermission } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { formatMoneyMinor, isUuid } from "@/lib/admin/validation";
import { FILE_TYPES, TYPE_LABELS, type ProductType } from "@/lib/products";

export const metadata = { title: "Edit product" };

export default async function ProductEditPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!isUuid(productId)) notFound();
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const [{ data }, { data: prices }, { data: file }, { data: items }, { data: related }, { data: others }, library] = await Promise.all([
    ctx.supabase.from("products").select("*, courses(title, slug)").eq("id", productId).maybeSingle(),
    ctx.supabase.from("product_prices").select("currency, amount_minor").eq("product_id", productId),
    ctx.supabase.from("product_files").select("file_name, file_size, updated_at").eq("product_id", productId).maybeSingle(),
    ctx.supabase.from("bundle_items").select("product_id").eq("bundle_id", productId).order("position"),
    ctx.supabase.from("related_products").select("related_id").eq("product_id", productId).order("position"),
    ctx.supabase.from("products").select("id, name, product_type, status").neq("id", productId).neq("status", "archived").order("name"),
    getLibraryImages(ctx),
  ]);
  if (!data) notFound();
  const p = data as ProductRow & { courses: { title: string; slug: string } | null };
  const type = p.product_type as ProductType;
  const priceMap = Object.fromEntries(((prices ?? []) as { currency: string; amount_minor: number }[]).map((r) => [r.currency, r.amount_minor]));
  const opts = ((others ?? []) as { id: string; name: string; product_type: ProductType; status: string }[]);

  // Sales from real payments, only for staff who may see money.
  let sales: { orders: number; revenue: string } | null = null;
  if (ctx.can("payments")) {
    const { data: pays } = await ctx.supabase.from("payments").select("amount_minor, currency").eq("product_id", productId).eq("status", "successful");
    const by = new Map<string, number>();
    ((pays ?? []) as { amount_minor: number; currency: string }[]).forEach((r) => by.set(r.currency, (by.get(r.currency) ?? 0) + r.amount_minor));
    sales = { orders: pays?.length ?? 0, revenue: by.size ? [...by].map(([c, v]) => formatMoneyMinor(v, c)).join(" · ") : "0" };
  }
  const publicHref = type === "course" && p.courses ? `/academy/courses/${p.courses.slug}` : `/academy/books/${p.slug}`;

  return (
    <>
      <PageHeader eyebrow={TYPE_LABELS[type]} title={p.name}
        subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/products" className="underline underline-offset-4">All products</Link><StatusBadge status={p.status} /></span>}
        actions={p.status === "published" ? <a href={publicHref} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink">View live<ExternalLink aria-hidden className="h-3.5 w-3.5" /></a> : undefined} />
      {sales && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Orders" value={sales.orders} />
          <StatCard label="Revenue" value={sales.revenue} />
        </div>
      )}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ProductDetailsForm p={p} library={library} />
        <div className="space-y-8">
          {type === "course"
            ? <Panel title="Prices">Course products use the course&apos;s own prices. <Link href={`/admin/courses/${p.course_id}?tab=pricing`} className="underline underline-offset-4">Edit course pricing</Link>.</Panel>
            : <ProductPricesForm productId={p.id} prices={priceMap} />}
          {FILE_TYPES.includes(type) && <ProductFileUpload productId={p.id} current={(file as { file_name: string; file_size: number | null; updated_at: string } | null) ?? null} />}
        </div>
      </div>
      {type === "bundle" && (
        <div className="mt-8"><BundleItemsForm productId={p.id} selected={((items ?? []) as { product_id: string }[]).map((i) => i.product_id)}
          options={opts.filter((o) => o.product_type !== "bundle").map((o) => ({ id: o.id, name: o.name, note: `${TYPE_LABELS[o.product_type]}${o.status !== "published" ? " · draft" : ""}` }))} /></div>
      )}
      <div className="mt-8"><RelatedProductsForm productId={p.id} selected={((related ?? []) as { related_id: string }[]).map((r) => r.related_id)}
        options={opts.map((o) => ({ id: o.id, name: o.name, note: `${TYPE_LABELS[o.product_type]}${o.status !== "published" ? " · draft" : ""}` }))} /></div>
    </>
  );
}
