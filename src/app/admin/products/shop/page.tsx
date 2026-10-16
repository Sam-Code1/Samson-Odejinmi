import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { ShopSettingsForm, type ShopSettingsRow } from "@/components/admin/ProductForms";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "Shop settings" };

export default async function ShopSettingsPage() {
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.from("shop_settings").select("*").eq("id", true).maybeSingle();
  return (
    <>
      <PageHeader eyebrow="Sales" title="Shop settings" subtitle={<>The shop page&apos;s title, introduction, empty state and email sign-up. Products, prices, order and featured items are set on each product. <Link href="/admin/products" className="underline underline-offset-4">All products</Link></>}
        actions={<a href="/academy/shop" target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink">View shop<ExternalLink aria-hidden className="h-3.5 w-3.5" /></a>} />
      {error || !data ? <AdminError title="Shop settings need migration 0009" body="Run supabase/migrations/0009_batch4_finalization.sql, then refresh." /> : <div className="max-w-3xl"><ShopSettingsForm s={data as ShopSettingsRow} /></div>}
    </>
  );
}
