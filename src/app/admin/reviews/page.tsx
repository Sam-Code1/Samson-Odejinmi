import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deleteReview, moderateReview } from "@/app/admin/actions/reviews";
import { requirePermission } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reviews" };
type Row = {
  id: string; rating: number; title: string | null; body: string | null; display_name: string; verified: boolean; status: string; report_count: number; created_at: string;
  user_id: string | null; payment_id: string | null; products: { name: string; slug: string } | null; profiles: { email: string | null } | null; payments: { order_number: string | null; guest_email: string | null } | null;
};
const TABS = [{ id: "pending", label: "Pending" }, { id: "flagged", label: "Flagged" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }, { id: "hidden", label: "Hidden" }];

/** Moderation queue. Only owners can submit reviews (checked by the database); only approved reviews are public. */
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = TABS.some((t) => t.id === first(sp.status)) ? first(sp.status)! : "pending";
  const page = pageParam(sp.page);
  const ctx = await requirePermission("products");
  if (!ctx) return null;
  const { data, count, error } = await ctx.supabase.from("product_reviews")
    .select("id, rating, title, body, display_name, verified, status, report_count, created_at, user_id, payment_id, products(name, slug), payments(order_number, guest_email)", { count: "exact" })
    .eq("status", status).order("created_at", { ascending: status === "pending" }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];
  // Account emails for the reviewers on this page.
  const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
  const { data: profs } = ids.length ? await ctx.supabase.from("profiles").select("id, email").in("id", ids) : { data: [] };
  const email = new Map(((profs ?? []) as { id: string; email: string | null }[]).map((p) => [p.id, p.email]));
  const act = (r: Row, to: string, label: string, variant: "outline" | "primary" | "danger" = "outline") =>
    <ActionButton key={to} action={moderateReview} fields={{ reviewId: r.id, status: to }} variant={variant}>{label}</ActionButton>;

  return (
    <>
      <PageHeader eyebrow="Sales" title="Reviews" subtitle="Every review comes from a verified buyer. Approve to publish; reject, hide or delete otherwise. Three reports from different people move a published review to Flagged." />
      <nav aria-label="Review status" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/reviews?status=${t.id}`} aria-current={t.id === status ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full px-4 text-label", t.id === status ? "bg-ink text-canvas" : "border border-line text-ink-2 hover:border-ink")}>{t.label}</Link>
        ))}
      </nav>
      {error ? <AdminError title="Reviews need migration 0014" body="Run supabase/migrations/0014_product_reviews.sql in the Supabase SQL editor, then refresh." /> : (
        <>
          <DataTable<Row> rows={rows} rowKey={(r) => r.id}
            empty={{ title: `No ${status} reviews`, body: status === "pending" ? "New reviews from buyers appear here for approval." : "Nothing here." }}
            columns={[
              { key: "p", header: "Product", primary: true, cell: (r) => r.products ? <Link href={`/shop/${r.products.slug}#reviews`} target="_blank" className="underline underline-offset-4">{r.products.name}</Link> : "–" },
              { key: "r", header: "Rating", className: "tabular-nums", cell: (r) => <span aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span className="text-ink-3">{"★".repeat(5 - r.rating)}</span> {r.rating}/5</span> },
              { key: "t", header: "Review", cell: (r) => <div className="max-w-md">{r.title && <p className="font-medium">{r.title}</p>}{r.body && <p className="line-clamp-4 whitespace-pre-line text-body-sm text-ink-2">{r.body}</p>}</div> },
              { key: "c", header: "Customer", cell: (r) => <>{r.display_name}<span className="block break-all text-caption text-ink-3">{r.user_id ? `${email.get(r.user_id) ?? "Account"} · Account` : `${r.payments?.guest_email ?? "Guest"} · Guest`}</span>
                <span className="block text-caption text-ink-3">{r.verified ? "Verified purchase" : "Not verified"}{r.payments?.order_number ? ` · ${r.payments.order_number}` : ""}</span></> },
              { key: "s", header: "Status", cell: (r) => <><StatusBadge status={r.status} />{r.report_count > 0 && <span className="block text-caption text-warm">{r.report_count} report{r.report_count === 1 ? "" : "s"}</span>}</> },
              { key: "d", header: "Date", cell: (r) => formatDate(r.created_at, true) },
              { key: "x", header: "", className: "text-right", cell: (r) => (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {r.status !== "approved" && act(r, "approved", r.status === "hidden" || r.status === "flagged" ? "Restore" : "Approve", "primary")}
                  {r.status !== "rejected" && r.status !== "approved" && act(r, "rejected", "Reject")}
                  {r.status === "approved" && act(r, "hidden", "Hide")}
                  <ActionButton action={deleteReview} fields={{ reviewId: r.id }} variant="danger" confirm={{ title: "Delete this review?", body: "It's removed permanently. To keep a record instead, reject or hide it.", label: "Delete" }}>Delete</ActionButton>
                </div>
              ) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ status }} />
        </>
      )}
    </>
  );
}
