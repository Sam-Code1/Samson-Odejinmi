import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { CouponForm } from "@/components/admin/CouponForm";
import { requirePermission } from "@/lib/admin/guard";

export const metadata = { title: "New coupon" };

export default async function NewCoupon() {
  const ctx = await requirePermission("coupons");
  if (!ctx) return null;
  const { data: courses } = await ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title");
  return (
    <>
      <PageHeader eyebrow="Marketing" title="New coupon" subtitle={<Link href="/admin/coupons" className="underline underline-offset-4">All coupons</Link>} />
      <div className="max-w-3xl"><CouponForm courses={(courses ?? []) as { id: string; title: string }[]} selected={[]} /></div>
    </>
  );
}
