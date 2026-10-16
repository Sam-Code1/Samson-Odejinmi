import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { PostForm } from "@/components/admin/MarketingForms";
import { requirePermission } from "@/lib/admin/guard";
import { first, isUuid } from "@/lib/admin/validation";
import { site } from "@/lib/site";

export const metadata = { title: "New post" };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const campaign = first((await searchParams).campaign);
  const { data } = await ctx.supabase.from("marketing_campaigns").select("id, name, slug").neq("status", "archived").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow="Campaigns" title="New post" subtitle={<Link href="/admin/marketing/campaigns" className="underline underline-offset-4">All campaigns</Link>} />
      <div className="max-w-3xl"><PostForm campaigns={(data ?? []) as { id: string; name: string; slug: string }[]} defaultCampaign={isUuid(campaign) ? campaign : undefined} siteUrl={site.url} /></div>
    </>
  );
}
