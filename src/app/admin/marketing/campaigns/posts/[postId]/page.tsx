import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { PostForm, type PostRow } from "@/components/admin/MarketingForms";
import { ActionButton } from "@/components/admin/ActionButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { deleteContentPost } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin/guard";
import { isUuid } from "@/lib/admin/validation";
import { site } from "@/lib/site";

export const metadata = { title: "Post" };

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!isUuid(postId)) notFound();
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data }, { data: camps }] = await Promise.all([
    ctx.supabase.from("content_posts").select("*").eq("id", postId).maybeSingle(),
    ctx.supabase.from("marketing_campaigns").select("id, name, slug").neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const post = data as PostRow;
  return (
    <>
      <PageHeader eyebrow="Post" title={post.title}
        subtitle={<span className="flex flex-wrap items-center gap-3"><Link href={post.campaign_id ? `/admin/marketing/campaigns/${post.campaign_id}` : "/admin/marketing/campaigns"} className="underline underline-offset-4">Back to campaign</Link><StatusBadge status={post.status} />{post.ai_assisted && <span className="text-caption">AI-assisted draft</span>}</span>} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <PostForm post={post} campaigns={(camps ?? []) as { id: string; name: string; slug: string }[]} siteUrl={site.url} />
        <Panel title="Danger zone">
          <ActionButton action={deleteContentPost} fields={{ postId }} variant="danger" className="h-9 px-3" confirm={{ title: "Delete this post?", body: "The plan is removed. Anything already posted on social media stays there.", label: "Delete post" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete post</ActionButton>
        </Panel>
      </div>
    </>
  );
}
