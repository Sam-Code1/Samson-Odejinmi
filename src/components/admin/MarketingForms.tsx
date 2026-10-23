"use client";

import { useMemo, useState } from "react";
import { saveContentPost, saveMarketingCampaign } from "@/app/admin/actions/marketing";
import { buildTrackedUrl } from "@/lib/attribution";
import { AdminForm } from "./AdminForm";
import { CopyButton } from "./CopyButton";
import { FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";

export type CampaignRow = { id: string; name: string; slug: string; description: string | null; starts_on: string | null; ends_on: string | null; status: string };

export function CampaignForm({ c }: { c?: CampaignRow }) {
  return (
    <AdminForm action={saveMarketingCampaign} submitLabel={c ? "Save campaign" : "Create campaign"}>
      {c && <input type="hidden" name="campaignId" value={c.id} />}
      <FormSection title="Campaign" description="One initiative, e.g. a launch. Its slug is the utm_campaign value used in links, so sales can be counted.">
        <TextInput label="Name" name="name" required defaultValue={c?.name ?? ""} maxLength={120} className="sm:col-span-2" />
        <TextInput label="Slug (utm_campaign)" name="slug" defaultValue={c?.slug ?? ""} maxLength={60} hint="Lowercase with dashes, e.g. blender-launch-2026. Generated from the name if empty." />
        <SelectInput label="Status" name="status" defaultValue={c?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "archived", label: "Archived" }]} />
        <TextInput label="Starts (optional)" name="starts_on" type="date" defaultValue={c?.starts_on ?? ""} />
        <TextInput label="Ends (optional)" name="ends_on" type="date" defaultValue={c?.ends_on ?? ""} />
        <TextAreaInput label="Goal and notes" name="description" rows={3} defaultValue={c?.description ?? ""} maxLength={2000} className="sm:col-span-2" />
      </FormSection>
    </AdminForm>
  );
}

export type PostRow = {
  id: string; campaign_id: string | null; platform: string; title: string; copy: string | null; creative_url: string | null; cta_label: string | null; cta_url: string | null;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null;
  scheduled_for: string | null; published_url: string | null; status: string; ai_assisted?: boolean;
};

const PLATFORMS = [["instagram", "Instagram"], ["x", "X"], ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["facebook", "Facebook"], ["whatsapp", "WhatsApp"], ["tiktok", "TikTok"], ["other", "Other"]] as const;
const MEDIUM: Record<string, string> = { instagram: "social", x: "social", linkedin: "social", youtube: "video", facebook: "social", whatsapp: "messaging", tiktok: "social", other: "referral" };
const local = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export function PostForm({ post, campaigns, defaultCampaign, siteUrl, prefill }: {
  post?: PostRow; campaigns: { id: string; name: string; slug: string }[]; defaultCampaign?: string; siteUrl: string;
  prefill?: { title?: string; copy?: string; platform?: string; cta_label?: string; utm_campaign?: string };
}) {
  const startCampaign = post?.campaign_id ?? defaultCampaign ?? "";
  const [platform, setPlatform] = useState(post?.platform ?? prefill?.platform ?? "instagram");
  const [campaignId, setCampaignId] = useState(startCampaign);
  const [cta, setCta] = useState(post?.cta_url ?? "/academy/books");
  const [utm, setUtm] = useState({
    source: post?.utm_source ?? "", medium: post?.utm_medium ?? "", campaign: post?.utm_campaign ?? prefill?.utm_campaign ?? "", content: post?.utm_content ?? "", term: post?.utm_term ?? "",
  });
  const campSlug = campaigns.find((c) => c.id === campaignId)?.slug ?? "";
  const effective = { source: utm.source || platform, medium: utm.medium || MEDIUM[platform], campaign: utm.campaign || campSlug, content: utm.content, term: utm.term };
  const link = useMemo(() => {
    if (!cta) return null;
    const base = cta.startsWith("/") ? `${siteUrl}${cta}` : cta;
    return buildTrackedUrl(base, effective);
  }, [cta, siteUrl, effective.source, effective.medium, effective.campaign, effective.content, effective.term]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminForm action={saveContentPost} submitLabel={post ? "Save post" : "Create post"}>
      {post && <input type="hidden" name="postId" value={post.id} />}
      {prefill && <input type="hidden" name="ai_assisted" value="1" />}
      {/* Store what the link really uses, so the post's numbers line up with attribution. */}
      <input type="hidden" name="utm_source" value={effective.source} />
      <input type="hidden" name="utm_medium" value={effective.medium} />
      <input type="hidden" name="utm_campaign" value={effective.campaign} />
      <FormSection title="Post" description="Planning only: the app never publishes to social networks. Post it yourself, then mark it published and paste the link.">
        <TextInput label="Internal title" name="title" required defaultValue={post?.title ?? prefill?.title ?? ""} maxLength={120} className="sm:col-span-2" />
        <SelectInput label="Platform" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} options={PLATFORMS.map(([value, label]) => ({ value, label }))} />
        <SelectInput label="Campaign" name="campaign_id" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} options={[{ value: "", label: "None" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]} />
        <TextAreaInput label="Copy" name="copy" rows={7} defaultValue={post?.copy ?? prefill?.copy ?? ""} maxLength={5000} className="sm:col-span-2" hint={platform === "x" ? "X allows 280 characters (links count as 23)." : undefined} />
        <TextInput label="Creative (image/video link, optional)" name="creative_url" defaultValue={post?.creative_url ?? ""} maxLength={500} className="sm:col-span-2" hint="A link to the image or video in your media library or drive." />
      </FormSection>
      <FormSection title="Call to action and tracking">
        <TextInput label="CTA label" name="cta_label" defaultValue={post?.cta_label ?? prefill?.cta_label ?? ""} maxLength={60} placeholder="Get the ebook" />
        <TextInput label="CTA link" name="cta_url" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={500} hint="A page on your site (/academy/books/…) or a full https:// link." />
        <TextInput label="utm_source" name="utm_source_display" value={utm.source} onChange={(e) => setUtm({ ...utm, source: e.target.value })} placeholder={platform} />
        <TextInput label="utm_medium" name="utm_medium_display" value={utm.medium} onChange={(e) => setUtm({ ...utm, medium: e.target.value })} placeholder={MEDIUM[platform]} />
        <TextInput label="utm_campaign" name="utm_campaign_display" value={utm.campaign} onChange={(e) => setUtm({ ...utm, campaign: e.target.value })} placeholder={campSlug || "campaign-name"} />
        <TextInput label="utm_content (optional)" name="utm_content" value={utm.content} onChange={(e) => setUtm({ ...utm, content: e.target.value })} placeholder="e.g. carousel-1" />
        <TextInput label="utm_term (optional)" name="utm_term" value={utm.term} onChange={(e) => setUtm({ ...utm, term: e.target.value })} />
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-caption font-semibold text-ink-3">Link to post</p>
          {link ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded bg-surface px-3 py-2 text-caption">{link}</code>
              <CopyButton value={link} label="Copy" />
            </div>
          ) : <p className="text-caption text-warm">Enter a valid CTA link to build the tracked URL.</p>}
        </div>
      </FormSection>
      <FormSection title="Schedule and status">
        <SelectInput label="Status" name="status" defaultValue={post?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "scheduled", label: "Scheduled (planned)" }, { value: "published", label: "Published (I posted it)" }, { value: "archived", label: "Archived" }]} />
        <TextInput label="Planned for (UTC)" name="scheduled_for" type="datetime-local" defaultValue={local(post?.scheduled_for ?? null)} />
        <TextInput label="Live post link (after posting)" name="published_url" defaultValue={post?.published_url ?? ""} maxLength={500} className="sm:col-span-2" />
      </FormSection>
    </AdminForm>
  );
}
