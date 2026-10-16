import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";

export const metadata = { title: "Campaigns" };
type Camp = { id: string; name: string; slug: string; status: string; starts_on: string | null; ends_on: string | null; content_posts: { count: number }[] };
type Post = { id: string; title: string; platform: string; status: string; scheduled_for: string | null };

export default async function CampaignsPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data, error }, { data: loose }] = await Promise.all([
    ctx.supabase.from("marketing_campaigns").select("id, name, slug, status, starts_on, ends_on, content_posts(count)").neq("status", "archived").order("created_at", { ascending: false }),
    ctx.supabase.from("content_posts").select("id, title, platform, status, scheduled_for").is("campaign_id", null).neq("status", "archived").order("scheduled_for", { ascending: true, nullsFirst: false }).limit(50),
  ]);
  const btn = "inline-flex h-10 items-center gap-2 rounded px-4 text-label";
  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="Campaigns" subtitle="Plan launches and the posts that go with them. Each campaign's slug is its utm_campaign, so orders from its links (and its coupons) are counted in Analytics. Nothing is posted automatically."
        actions={<><Link href="/admin/marketing/campaigns/posts/new" className={`${btn} border border-line-strong hover:border-ink`}>New post</Link><Link href="/admin/marketing/campaigns/new" className={`${btn} bg-ink text-canvas hover:bg-ink/90`}><Plus aria-hidden className="h-4 w-4" />New campaign</Link></>} />
      {error ? <AdminError title="Campaigns need the Batch 3 migration" body="Run supabase/migrations/0008_batch3_products_marketing.sql, then refresh." /> : (
        <>
          <DataTable<Camp> rows={(data ?? []) as unknown as Camp[]} rowKey={(r) => r.id}
            empty={{ title: "No campaigns yet", body: "Create one for your next launch, then plan its posts and emails.", action: { href: "/admin/marketing/campaigns/new", label: "Create a campaign" } }}
            columns={[
              { key: "n", header: "Campaign", primary: true, cell: (r) => <div><Link href={`/admin/marketing/campaigns/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><p className="text-caption text-ink-3">utm_campaign={r.slug}</p></div> },
              { key: "d", header: "Dates", cell: (r) => (r.starts_on ? `${formatDate(r.starts_on)}${r.ends_on ? ` – ${formatDate(r.ends_on)}` : ""}` : "–") },
              { key: "p", header: "Posts", className: "tabular-nums", cell: (r) => r.content_posts?.[0]?.count ?? 0 },
              { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            ]} />
          {(loose ?? []).length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-admin-section">Posts without a campaign</h2>
              <DataTable<Post> rows={(loose ?? []) as Post[]} rowKey={(r) => r.id} empty={{ title: "" }}
                columns={[
                  { key: "t", header: "Post", primary: true, cell: (r) => <Link href={`/admin/marketing/campaigns/posts/${r.id}`} className="font-semibold hover:underline">{r.title}</Link> },
                  { key: "p", header: "Platform", cell: (r) => <span className="capitalize">{r.platform}</span> },
                  { key: "w", header: "Planned", cell: (r) => (r.scheduled_for ? formatDate(r.scheduled_for, true) : "–") },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                ]} />
            </section>
          )}
        </>
      )}
    </>
  );
}
