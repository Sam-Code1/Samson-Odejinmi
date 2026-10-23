"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, getAdminContext, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, optStr, slugify, str, SLUG_RE } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { createServiceClient } from "@/lib/supabase/admin";
import { buildTrackedUrl, cleanToken } from "@/lib/attribution";
import { buildMarketingEmail, marketingEmailConfigured, sendMarketingEmail } from "@/lib/email/marketing";
import { processEmailQueue, runMarketingJobs } from "@/lib/marketing/engine";
import { parseDefinition } from "@/lib/marketing/segments";
import { isTrigger, validateSteps } from "@/lib/marketing/steps";
import { site as siteInfo } from "@/lib/site";

/**
 * Admin → Marketing ("marketing" permission). Nothing here sends anything automatically: emails go out only when an
 * admin presses "Send now" / schedules a campaign, or an automation they activated reaches a send step; and only to
 * contacts who opted in. Social posts are never published by the app.
 */
const date = (v: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00Z` : v).toISOString() : null);
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const httpsOrPath = (v: string | null) => (!v ? null : v.startsWith("/") && !v.startsWith("//") ? v.slice(0, 500) : /^https:\/\/[^\s]+$/.test(v) ? v.slice(0, 500) : "invalid");

// ═════════════════ CAMPAIGNS (umbrella) ═════════════════
export async function saveMarketingCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "campaignId", 40);
    const name = str(fd, "name", 120);
    const slug = slugify(str(fd, "slug", 60) || name).slice(0, 60);
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes. This becomes utm_campaign.";
    const status = str(fd, "status", 12) || "draft";
    if (!["draft", "active", "completed", "archived"].includes(status)) errors.status = "Choose a status.";
    const starts = day(str(fd, "starts_on", 10)), ends = day(str(fd, "ends_on", 10));
    if (starts && ends && starts > ends) errors.ends_on = "The end must be after the start.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const row = { name, slug, status, description: optStr(fd, "description", 2000), starts_on: starts, ends_on: ends };
    const res = isUuid(id)
      ? await ctx.supabase.from("marketing_campaigns").update(row).eq("id", id).select("id").single()
      : await ctx.supabase.from("marketing_campaigns").insert({ ...row, created_by: ctx.user.id }).select("id").single();
    if (res.error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another campaign already uses that slug." } };
    if (res.error || !res.data) return dbError(res.error);
    await logActivity(ctx, isUuid(id) ? "campaign updated" : "campaign created", "marketing_campaign", res.data.id as string, name);
    revalidatePath("/admin/marketing/campaigns");
    if (!isUuid(id)) redirect(`/admin/marketing/campaigns/${res.data.id}`);
    revalidatePath(`/admin/marketing/campaigns/${id}`);
    return { ok: true, message: "Campaign saved." };
  });
}

// ═════════════════ CONTENT POSTS ═════════════════
const PLATFORMS = ["instagram", "x", "linkedin", "youtube", "facebook", "whatsapp", "tiktok", "other"];

export async function saveContentPost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "postId", 40), campaignId = str(fd, "campaign_id", 40);
    const errors: Record<string, string> = {};
    const title = str(fd, "title", 120);
    if (!title) errors.title = "Give the post a short internal title.";
    const platform = str(fd, "platform", 20);
    if (!PLATFORMS.includes(platform)) errors.platform = "Choose a platform.";
    const status = str(fd, "status", 12) || "draft";
    if (!["draft", "scheduled", "published", "archived"].includes(status)) errors.status = "Choose a status.";
    const cta = httpsOrPath(optStr(fd, "cta_url", 500)), creative = httpsOrPath(optStr(fd, "creative_url", 500));
    if (cta === "invalid") errors.cta_url = "Use a full https:// link or a site path like /academy/books.";
    if (creative === "invalid") errors.creative_url = "Use a full https:// link to the image or video.";
    const published = optStr(fd, "published_url", 500);
    if (published && !/^https:\/\/\S+$/.test(published)) errors.published_url = "Use the full https:// link of the live post.";
    const scheduled = date(str(fd, "scheduled_for", 40));
    if (status === "scheduled" && !scheduled) errors.scheduled_for = "Choose when it should go out.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const row = {
      campaign_id: isUuid(campaignId) ? campaignId : null, platform, title, copy: optStr(fd, "copy", 5000), creative_url: creative, cta_label: optStr(fd, "cta_label", 60), cta_url: cta,
      utm_source: cleanToken(str(fd, "utm_source", 60)) ?? null, utm_medium: cleanToken(str(fd, "utm_medium", 60)) ?? null, utm_campaign: cleanToken(str(fd, "utm_campaign", 60)) ?? null,
      utm_content: cleanToken(str(fd, "utm_content", 60)) ?? null, utm_term: cleanToken(str(fd, "utm_term", 60)) ?? null,
      scheduled_for: scheduled, status, published_url: published, ...(fd.get("ai_assisted") === "1" ? { ai_assisted: true } : {}),
    };
    const res = isUuid(id)
      ? await ctx.supabase.from("content_posts").update(row).eq("id", id).select("id").single()
      : await ctx.supabase.from("content_posts").insert({ ...row, created_by: ctx.user.id }).select("id").single();
    if (res.error || !res.data) return dbError(res.error);
    revalidatePath("/admin/marketing/campaigns", "layout");
    if (!isUuid(id)) redirect(`/admin/marketing/campaigns/posts/${res.data.id}`);
    return { ok: true, message: status === "published" ? "Saved as published (you posted it yourself)." : "Post saved." };
  });
}

export async function deleteContentPost(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "postId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing post." };
    const { error } = await ctx.supabase.from("content_posts").delete().eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/marketing/campaigns", "layout");
    redirect("/admin/marketing/campaigns");
  });
}

/** Builds the UTM link for a post (preview only; nothing is saved). */
export async function previewTrackedLink(base: string, utm: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }): Promise<string | null> {
  const ctx = await getAdminContext();
  if (!ctx?.can("marketing")) return null;
  const site = siteInfo.url;
  return buildTrackedUrl(base.startsWith("/") ? `${site}${base}` : base, utm);
}

// ═════════════════ SEGMENTS ═════════════════
export async function saveSegment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "segmentId", 40), name = str(fd, "name", 80);
    if (!name) return { ok: false, fieldErrors: { name: "Name the audience." } };
    const p = parseDefinition(fd);
    if (!p.ok) return { ok: false, fieldErrors: { preset: p.error } };
    const row = { name, description: optStr(fd, "description", 300), definition: p.def };
    const res = isUuid(id)
      ? await ctx.supabase.from("segments").update(row).eq("id", id).select("id").single()
      : await ctx.supabase.from("segments").insert({ ...row, created_by: ctx.user.id }).select("id").single();
    if (res.error || !res.data) return dbError(res.error);
    revalidatePath("/admin/marketing/email/segments");
    return { ok: true, message: "Audience saved." };
  });
}

export async function deleteSegment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "segmentId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing audience." };
    const { error } = await ctx.supabase.from("segments").delete().eq("id", id);
    if (error) return dbError(error);
    revalidatePath("/admin/marketing/email/segments");
    return { ok: true, message: "Audience deleted. Campaigns that used it keep their own copy of the rules." };
  });
}

/** Live audience size for the editor (counts only, no personal data). */
export async function countAudience(fd: FormData): Promise<{ ok: true; total: number; marketable: number } | { ok: false; error: string }> {
  const ctx = await getAdminContext();
  if (!ctx?.can("marketing")) return { ok: false, error: "You don't have permission to do that." };
  const p = parseDefinition(fd);
  if (!p.ok) return { ok: false, error: p.error };
  const { data, error } = await ctx.supabase.rpc("segment_count", { p_def: p.def });
  if (error || !data) return { ok: false, error: "Couldn't count this audience. Run migration 0008." };
  const d = data as { total: number; marketable: number };
  return { ok: true, total: d.total, marketable: d.marketable };
}

// ═════════════════ EMAIL CAMPAIGNS ═════════════════
async function loadCampaign(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, id: string) {
  const { data } = await ctx.supabase.from("email_campaigns").select("*").eq("id", id).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function saveEmailCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    if (isUuid(id)) {
      const c = await loadCampaign(ctx, id);
      if (!c) return { ok: false, error: "That campaign no longer exists." };
      if (!["draft", "scheduled"].includes(c.status as string)) return { ok: false, error: "Sent or sending campaigns can't be edited." };
    }
    const errors: Record<string, string> = {};
    const name = str(fd, "name", 120), subject = str(fd, "subject", 160), body = str(fd, "body", 30000);
    if (!name) errors.name = "Name is required (internal).";
    if (!subject) errors.subject = "Subject is required.";
    if (!body) errors.body = "Write the message.";
    const segmentId = str(fd, "segment_id", 40);
    const p = parseDefinition(fd);
    if (!isUuid(segmentId) && !p.ok) errors.preset = p.error;
    const campaignId = str(fd, "campaign_id", 40);
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const row = {
      name, subject, body, preview_text: optStr(fd, "preview_text", 200), from_name: optStr(fd, "from_name", 60),
      segment_id: isUuid(segmentId) ? segmentId : null, audience: p.ok ? p.def : { preset: "all_subscribers" },
      campaign_id: isUuid(campaignId) ? campaignId : null, ...(fd.get("ai_assisted") === "1" ? { ai_assisted: true } : {}),
    };
    const res = isUuid(id)
      ? await ctx.supabase.from("email_campaigns").update(row).eq("id", id).select("id").single()
      : await ctx.supabase.from("email_campaigns").insert({ ...row, created_by: ctx.user.id, status: "draft" }).select("id").single();
    if (res.error || !res.data) return dbError(res.error);
    revalidatePath("/admin/marketing/email");
    if (!isUuid(id)) redirect(`/admin/marketing/email/${res.data.id}`);
    revalidatePath(`/admin/marketing/email/${id}`);
    return { ok: true, message: "Draft saved." };
  });
}

export async function sendTestEmail(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    if (!isUuid(id)) return { ok: false, error: "Save the campaign first." };
    if (!ctx.user.email) return { ok: false, error: "Your account has no email address." };
    if (!marketingEmailConfigured()) return { ok: false, error: "Email isn't configured (RESEND_API_KEY). Nothing was sent." };
    const c = await loadCampaign(ctx, id);
    if (!c) return { ok: false, error: "That campaign no longer exists." };
    const { data: me } = await ctx.supabase.from("contacts").select("unsubscribe_token, first_name").eq("user_id", ctx.user.id).maybeSingle();
    const email = buildMarketingEmail({
      firstName: (me?.first_name as string) ?? null, subject: `[Test] ${c.subject as string}`, previewText: (c.preview_text as string) ?? null, body: c.body as string,
      // A test goes to you: the unsubscribe link is your own (if you have a contact record) so it really works.
      unsubscribeToken: (me?.unsubscribe_token as string) ?? "0".repeat(64), messageId: null,
    });
    const r = await sendMarketingEmail({ to: ctx.user.email, fromName: (c.from_name as string) ?? null, email, category: "test" });
    if (!r.sent) return { ok: false, error: `The test didn't send (${r.reason}).` };
    return { ok: true, message: `Test sent to ${ctx.user.email}. It isn't counted in the campaign's numbers.` };
  });
}

export async function scheduleEmailCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    const when = date(str(fd, "scheduled_at", 40));
    if (!isUuid(id)) return { ok: false, error: "Save the campaign first." };
    if (!when || Date.parse(when) < Date.now() + 60_000) return { ok: false, fieldErrors: { scheduled_at: "Choose a time at least a minute from now (UTC)." } };
    const { data, error } = await ctx.supabase.from("email_campaigns").update({ status: "scheduled", scheduled_at: when }).eq("id", id).in("status", ["draft", "scheduled"]).select("name").maybeSingle();
    if (error) return dbError(error);
    if (!data) return { ok: false, error: "Only drafts can be scheduled." };
    await logActivity(ctx, "campaign scheduled", "email_campaign", id, data.name as string, { at: when });
    revalidatePath(`/admin/marketing/email/${id}`);
    return { ok: true, message: "Scheduled. It goes out on the next marketing run after that time (see the cron note on this page)." };
  });
}

export async function sendEmailCampaignNow(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    if (!isUuid(id)) return { ok: false, error: "Save the campaign first." };
    if (!marketingEmailConfigured()) return { ok: false, error: "Email isn't configured (RESEND_API_KEY). Nothing was sent." };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Sending needs SUPABASE_SERVICE_ROLE_KEY on the server." };
    const c = await loadCampaign(ctx, id);
    if (!c) return { ok: false, error: "That campaign no longer exists." };
    const { data: n, error } = await ctx.supabase.rpc("start_email_campaign", { p_campaign: id });
    if (error) return { ok: false, error: /current state/.test(error.message) ? "This campaign has already been sent or cancelled." : "The campaign couldn't start." };
    await logActivity(ctx, "campaign sent", "email_campaign", id, c.name as string, { recipients: Number(n) || 0 });
    const out = await processEmailQueue(service, 300);
    await service.rpc("finish_email_campaigns");
    revalidatePath(`/admin/marketing/email/${id}`);
    revalidatePath("/admin/marketing/email");
    const queued = Number(n) || 0;
    if (queued === 0) return { ok: true, message: "No one in this audience has opted in, so nothing was sent." };
    const left = queued - out.emailsSent - out.emailsFailed - out.emailsSkipped;
    return { ok: true, message: `Sending to ${queued} ${queued === 1 ? "person" : "people"}: ${out.emailsSent} sent${out.emailsFailed ? `, ${out.emailsFailed} failed` : ""}${left > 0 ? `, ${left} still queued (they go out on the next marketing run)` : ""}.` };
  });
}

export async function cancelEmailCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing campaign." };
    const { data, error } = await ctx.supabase.from("email_campaigns").update({ status: "cancelled" }).eq("id", id).in("status", ["scheduled", "sending"]).select("name").maybeSingle();
    if (error) return dbError(error);
    if (!data) return { ok: false, error: "Only scheduled or sending campaigns can be cancelled." };
    await logActivity(ctx, "campaign cancelled", "email_campaign", id, data.name as string);
    revalidatePath(`/admin/marketing/email/${id}`);
    return { ok: true, message: "Cancelled. Emails not yet sent won't go out." };
  });
}

export async function unscheduleEmailCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "emailId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing campaign." };
    const { error } = await ctx.supabase.from("email_campaigns").update({ status: "draft", scheduled_at: null }).eq("id", id).eq("status", "scheduled");
    if (error) return dbError(error);
    revalidatePath(`/admin/marketing/email/${id}`);
    return { ok: true, message: "Back to draft." };
  });
}

// ═════════════════ AUTOMATIONS ═════════════════
export async function saveAutomation(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "automationId", 40), name = str(fd, "name", 120), trigger = str(fd, "trigger_event", 40);
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (!isTrigger(trigger)) errors.trigger_event = "Choose what starts it.";
    let steps: unknown;
    try { steps = JSON.parse(str(fd, "steps", 200_000) || "[]"); } catch { steps = null; }
    const v = validateSteps(steps);
    if (!v.ok) errors.steps = v.error;
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const row = { name, trigger_event: trigger, steps: v.ok ? v.steps : [] };
    const res = isUuid(id)
      ? await ctx.supabase.from("automations").update(row).eq("id", id).select("id").single()
      : await ctx.supabase.from("automations").insert({ ...row, status: "draft", created_by: ctx.user.id }).select("id").single();
    if (res.error || !res.data) return dbError(res.error);
    await logActivity(ctx, isUuid(id) ? "automation updated" : "automation created", "automation", res.data.id as string, name);
    revalidatePath("/admin/marketing/automations");
    if (!isUuid(id)) redirect(`/admin/marketing/automations/${res.data.id}`);
    revalidatePath(`/admin/marketing/automations/${id}`);
    return { ok: true, message: "Automation saved. Changes apply to steps people haven't reached yet." };
  });
}

export async function setAutomationStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("marketing", async (ctx) => {
    const id = str(fd, "automationId", 40), status = str(fd, "status", 10);
    if (!isUuid(id) || !["active", "paused", "draft"].includes(status)) return { ok: false, error: "That change isn't valid." };
    const { data, error } = await ctx.supabase.from("automations").update({ status }).eq("id", id).select("name").maybeSingle();
    if (error || !data) return dbError(error);
    await logActivity(ctx, `automation ${status === "active" ? "activated" : status}`, "automation", id, data.name as string);
    revalidatePath(`/admin/marketing/automations/${id}`);
    revalidatePath("/admin/marketing/automations");
    return { ok: true, message: status === "active" ? "Active. It starts for new events from now on (past events aren't replayed)." : "Paused. Nobody new starts it; people already in it wait." };
  });
}

// ═════════════════ RUN NOW ═════════════════
export async function runMarketingNow(_: ActionResult): Promise<ActionResult> {
  return runAdmin("marketing", async () => {
    const s = await runMarketingJobs({ emailLimit: 300 });
    if (!s.ok) return { ok: false, error: s.reason ?? "The marketing run couldn't start." };
    return { ok: true, message: `Done: ${s.scheduledStarted} scheduled campaign(s) started, ${s.automationRuns} automation step run(s), ${s.emailsSent} email(s) sent${s.emailsFailed ? `, ${s.emailsFailed} failed` : ""}${s.emailsSkipped ? `, ${s.emailsSkipped} skipped (no consent)` : ""}.` };
  });
}

// ═════════════════ AI DRAFTS → editable drafts (never sent or published) ═════════════════
const PLATFORM_OF = (p?: string) => {
  const v = (p ?? "").toLowerCase();
  return ["instagram", "x", "linkedin", "youtube", "facebook", "whatsapp", "tiktok"].includes(v) ? v : v === "twitter" ? "x" : "other";
};

export async function saveAiDraftAsPost(draft: { title: string; body: string; platform?: string; cta_label?: string; utm_campaign?: string }): Promise<{ ok: false; error: string } | never> {
  const ctx = await getAdminContext();
  if (!ctx?.can("marketing")) return { ok: false, error: "You don't have permission to do that." };
  const title = String(draft?.title ?? "").trim().slice(0, 120) || "AI draft";
  const copy = String(draft?.body ?? "").trim().slice(0, 5000);
  if (!copy) return { ok: false, error: "That draft is empty." };
  const { data, error } = await ctx.supabase.from("content_posts").insert({
    title, copy, platform: PLATFORM_OF(draft.platform), cta_label: draft.cta_label?.slice(0, 60) ?? null,
    utm_campaign: cleanToken(draft.utm_campaign ?? "") ?? null, status: "draft", ai_assisted: true, created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't save the draft. Run migration 0008." };
  redirect(`/admin/marketing/campaigns/posts/${data.id}`);
}

export async function saveAiDraftAsEmail(draft: { title: string; body: string; subject?: string }): Promise<{ ok: false; error: string } | never> {
  const ctx = await getAdminContext();
  if (!ctx?.can("marketing")) return { ok: false, error: "You don't have permission to do that." };
  const body = String(draft?.body ?? "").trim().slice(0, 30000);
  if (!body) return { ok: false, error: "That draft is empty." };
  const { data, error } = await ctx.supabase.from("email_campaigns").insert({
    name: String(draft.title ?? "AI draft").slice(0, 120), subject: String(draft.subject || draft.title || "Draft").slice(0, 160), body,
    status: "draft", ai_assisted: true, audience: { preset: "all_subscribers" }, created_by: ctx.user.id,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "Couldn't save the draft. Run migration 0008." };
  redirect(`/admin/marketing/email/${data.id}`);
}
