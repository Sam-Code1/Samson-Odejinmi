import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { CouponForm, type CouponRow } from "@/components/admin/CouponForm";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { deleteCoupon, setCouponActive } from "@/app/admin/actions/coupons";
import { requirePermission } from "@/lib/admin/guard";
import { couponExtras } from "@/lib/admin/coupon-extras";
import { personName, type Person } from "@/lib/admin/format";
import { formatDate, formatMoneyMinor, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Edit coupon" };
type Redemption = { id: string; discount_minor: number; currency: string; created_at: string; profiles: Person; courses: { title: string } | null; payments: { reference: string; amount_minor: number; provider: string } | null };

export default async function CouponPage({ params }: { params: Promise<{ couponId: string }> }) {
  const { couponId } = await params;
  if (!isUuid(couponId)) notFound();
  const ctx = await requirePermission("coupons");
  if (!ctx) return null;
  const [{ data }, { data: courses }, { data: links }, { data: red }, extras] = await Promise.all([
    ctx.supabase.from("coupons").select("*").eq("id", couponId).maybeSingle(),
    ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    ctx.supabase.from("coupon_courses").select("course_id").eq("coupon_id", couponId),
    ctx.supabase.from("coupon_redemptions").select("id, discount_minor, currency, created_at, profiles:user_id(first_name, last_name, email), courses(title), payments(reference, amount_minor, provider)")
      .eq("coupon_id", couponId).order("created_at", { ascending: false }).limit(200),
    couponExtras(ctx, couponId),
  ]);
  if (!data) notFound();
  const c = data as CouponRow;
  const rows = (red ?? []) as unknown as Redemption[];
  // Campaign performance from real redemptions only.
  const byCur = new Map<string, { discount: number; revenue: number }>();
  rows.forEach((r) => {
    const m = byCur.get(r.currency) ?? { discount: 0, revenue: 0 };
    m.discount += r.discount_minor; m.revenue += r.payments?.amount_minor ?? 0;
    byCur.set(r.currency, m);
  });
  const fmt = (k: "discount" | "revenue") => (byCur.size ? [...byCur].map(([cur, v]) => formatMoneyMinor(v[k], cur)).join(" · ") : "0");

  return (
    <>
      <PageHeader eyebrow="Coupon" title={c.code} subtitle={<Link href="/admin/coupons" className="underline underline-offset-4">All coupons</Link>} />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Times used" value={rows.length} hint={c.usage_limit ? `of ${c.usage_limit} allowed` : "No total limit"} />
        <StatCard label="Revenue with this code" value={fmt("revenue")} />
        <StatCard label="Discount given" value={fmt("discount")} />
        <StatCard label="Status" value={c.active ? "Active" : "Disabled"} />
      </div>
      <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
        <CouponForm coupon={c} courses={(courses ?? []) as { id: string; title: string }[]} selected={((links ?? []) as { course_id: string }[]).map((l) => l.course_id)}
          products={extras.products} selectedProducts={extras.selectedProducts} campaigns={extras.campaigns} />
        <div className="space-y-6">
          <Panel title="Status">
            {c.active
              ? <ActionButton action={setCouponActive} fields={{ couponId, on: "no" }} variant="outline" confirm={{ title: `Disable ${c.code}?`, body: "It will be rejected at checkout.", label: "Disable" }}>Disable coupon</ActionButton>
              : <ActionButton action={setCouponActive} fields={{ couponId, on: "yes" }} variant="outline">Enable coupon</ActionButton>}
          </Panel>
          {rows.length === 0 && (
            <Panel title="Danger zone">
              <ActionButton action={deleteCoupon} fields={{ couponId }} variant="danger" className="h-9 px-3" confirm={{ title: `Delete ${c.code}?`, body: "Only unused coupons can be deleted.", label: "Delete coupon" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete coupon</ActionButton>
            </Panel>
          )}
        </div>
      </div>
      <section className="mt-10">
        <h2 className="mb-4 text-admin-section">Usage</h2>
        <DataTable<Redemption> rows={rows} rowKey={(r) => r.id} empty={{ title: "Not used yet", body: "Each confirmed purchase or free enrolment with this code appears here." }}
          columns={[
            { key: "s", header: "Student", primary: true, cell: (r) => personName(r.profiles) },
            { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
            { key: "d", header: "Discount", className: "tabular-nums", cell: (r) => formatMoneyMinor(r.discount_minor, r.currency) },
            { key: "p", header: "Paid", className: "tabular-nums", cell: (r) => (r.payments ? (r.payments.provider === "free" ? "Free" : formatMoneyMinor(r.payments.amount_minor, r.currency)) : "–") },
            { key: "r", header: "Reference", cell: (r) => r.payments?.reference ?? "–" },
            { key: "t", header: "Date", cell: (r) => formatDate(r.created_at, true) },
          ]} />
      </section>
    </>
  );
}
