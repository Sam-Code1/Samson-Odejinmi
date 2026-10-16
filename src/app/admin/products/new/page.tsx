import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { NewProductForm } from "@/components/admin/ProductForms";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const { data: courses } = await ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title");
  return (
    <>
      <PageHeader eyebrow="Sales" title="New product" subtitle={<Link href="/admin/products" className="underline underline-offset-4">All products</Link>} />
      <div className="max-w-3xl"><NewProductForm courses={(courses ?? []) as { id: string; title: string }[]} /></div>
    </>
  );
}
