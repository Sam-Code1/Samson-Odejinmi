import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { setCouponActive } from "@/app/admin/actions/coupons";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, formatMoneyMinor } from "@/lib/admin/validation";

export const metadata = { title: "Coupons" };
type Row = {
  id: string; code: string; description: string | null; discount_type: string; discount_value: number; currency: string | null; active: boolean;
  expires_at: string | null; starts_at: string | null; usage_limit: number | null; coupon_redemptions: { count: number }[];
};

function couponLabel(c: { discount_type: string; discount_value: number; currency: string | null }) {
  return c.discount_type === "percentage" ? `${c.discount_value}% off` : `${formatMoneyMinor(c.discount_value, c.currency ?? "NGN")} off`;
}

function state(c: Row) {
  const now = Date.now();
  if (!c.active) return "disabled";
  if (c.expires_at && +new Date(c.expires_at) <= now) return "expired";
  if (c.starts_at && +new Date(c.starts_at) > now) return "scheduled";
  if (c.usage_limit && (c.coupon_redemptions?.[0]?.count ?? 0) >= c.usage_limit) return "used up";
  return "active";
}

export default async function CouponsPage() {
  const ctx = await requirePermission("coupons");
  if (!ctx) return null;
  const { data, error } = await ctx.supabase.from("coupons")
    .select("id, code, description, discount_type, discount_value, currency, active, starts_at, expires_at, usage_limit, coupon_redemptions(count)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader eyebrow="Marketing" title="Coupons" subtitle="Discount codes for course checkout. The discount is always calculated on the server; nothing the browser sends can change a price."
        actions={<Link href="/admin/coupons/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />Create coupon</Link>} />
      {error ? <AdminError title="Unable to load coupons" body="Run supabase/migrations/0005_batch1_foundation.sql, then refresh." /> : (
        <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
          empty={{ title: "No coupons yet", body: "Create a code for a launch, a partner or a scholarship.", action: { href: "/admin/coupons/new", label: "Create your first coupon" } }}
          columns={[
            { key: "c", header: "Code", primary: true, cell: (r) => <div><Link href={`/admin/coupons/${r.id}`} className="font-semibold tracking-wide hover:underline">{r.code}</Link>{r.description && <p className="line-clamp-1 text-caption text-ink-3">{r.description}</p>}</div> },
            { key: "d", header: "Discount", cell: (r) => couponLabel(r) },
            { key: "u", header: "Used", className: "tabular-nums", cell: (r) => `${r.coupon_redemptions?.[0]?.count ?? 0}${r.usage_limit ? ` / ${r.usage_limit}` : ""}` },
            { key: "e", header: "Expires", cell: (r) => (r.expires_at ? formatDate(r.expires_at, true) : "Never") },
            { key: "s", header: "Status", cell: (r) => { const st = state(r); return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-meta font-semibold capitalize ${st === "active" ? "border-blue/40 text-blue" : st === "scheduled" ? "border-line-strong text-ink-2" : st === "disabled" ? "border-line text-ink-3" : "border-warm/50 text-warm"}`}>{st}</span>; } },
            { key: "a", header: "", className: "text-right", cell: (r) => r.active
              ? <ActionButton action={setCouponActive} fields={{ couponId: r.id, on: "no" }} confirm={{ title: `Disable ${r.code}?`, body: "Students won't be able to use it at checkout.", label: "Disable" }}>Disable</ActionButton>
              : <ActionButton action={setCouponActive} fields={{ couponId: r.id, on: "yes" }} variant="outline">Enable</ActionButton> },
          ]} />
      )}
    </>
  );
}
