import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CampaignForm, type CampaignRow } from "@/components/admin/MarketingForms";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Campaign" };
type Post = { id: string; title: string; platform: string; status: string; scheduled_for: string | null; published_url: string | null };

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (!isUuid(campaignId)) notFound();
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data }, { data: posts }, { data: emails }, { data: coupons }] = await Promise.all([
    ctx.supabase.from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle(),
    ctx.supabase.from("content_posts").select("id, title, platform, status, scheduled_for, published_url").eq("campaign_id", campaignId).order("scheduled_for", { ascending: true, nullsFirst: false }),
    ctx.supabase.from("email_campaigns").select("id, name, status").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    ctx.can("coupons") ? ctx.supabase.from("coupons").select("id, code, active").eq("campaign_id", campaignId) : Promise.resolve({ data: [] }),
  ]);
  if (!data) notFound();
  const c = data as CampaignRow;

  return (
    <>
      <PageHeader eyebrow="Campaign" title={c.name} subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/marketing/campaigns" className="underline underline-offset-4">All campaigns</Link><StatusBadge status={c.status} /><span className="text-caption">utm_campaign={c.slug}</span></span>}
        actions={<Link href={`/admin/marketing/campaigns/posts/new?campaign=${c.id}`} className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New post</Link>} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-admin-section">Posts</h2>
            <DataTable<Post> rows={(posts ?? []) as Post[]} rowKey={(r) => r.id}
              empty={{ title: "No posts planned", body: "Plan each post with its copy, CTA and tracked link.", action: { href: `/admin/marketing/campaigns/posts/new?campaign=${c.id}`, label: "Plan a post" } }}
              columns={[
                { key: "t", header: "Post", primary: true, cell: (r) => <Link href={`/admin/marketing/campaigns/posts/${r.id}`} className="font-semibold hover:underline">{r.title}</Link> },
                { key: "p", header: "Platform", cell: (r) => <span className="capitalize">{r.platform}</span> },
                { key: "w", header: "Planned", cell: (r) => (r.scheduled_for ? formatDate(r.scheduled_for, true) : "–") },
                { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              ]} />
          </section>
          <CampaignForm c={c} />
        </div>
        <div className="space-y-6">
          <Panel title="Emails in this campaign">
            {(emails ?? []).length === 0 ? <p className="text-body-sm text-ink-3">None yet. Choose this campaign when creating an email.</p> : (
              <ul className="divide-y divide-line">{((emails ?? []) as { id: string; name: string; status: string }[]).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-body-sm"><Link href={`/admin/marketing/email/${e.id}`} className="min-w-0 truncate hover:underline">{e.name}</Link><StatusBadge status={e.status} /></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Coupons in this campaign">
            {(coupons ?? []).length === 0 ? <p className="text-body-sm text-ink-3">None. Link a coupon to this campaign from the coupon&apos;s page.</p> : (
              <ul className="divide-y divide-line">{((coupons ?? []) as { id: string; code: string; active: boolean }[]).map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-3 py-2.5 text-body-sm"><Link href={`/admin/coupons/${k.id}`} className="font-semibold tracking-wide hover:underline">{k.code}</Link><StatusBadge status={k.active ? "active" : "archived"} /></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Results"><p className="text-body-sm text-ink-2">Orders and revenue for this campaign are in <Link href="/admin/marketing/analytics" className="underline underline-offset-4">Analytics</Link> (buyers who arrived with utm_campaign={c.slug}, or used one of its coupons).</p></Panel>
        </div>
      </div>
    </>
  );
}
