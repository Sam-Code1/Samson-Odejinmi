"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";
import { createServiceClient } from "@/lib/supabase/admin";
import { getSiteSettings } from "@/lib/cms";
import { sendEmail } from "@/lib/email";

/**
 * Reply to a website message from Admin → Messages ("website" permission).
 *   To:       the person who wrote in
 *   Reply-To: your contact inbox, so when they answer it lands with you (not with the sending service)
 *   BCC:      your contact inbox, so you have a copy in your mailbox
 * The reply is saved in the conversation with the provider's real result (sent / failed). A BCC copy arrives in your
 * INBOX; it does not appear in your mail app's Sent folder. Syncing with Gmail/Outlook Sent would need a mailbox
 * provider (see lib/email/providers.ts), which can be added later.
 */
export async function replyToMessage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "messageId", 40);
    const body = str(fd, "body", 10000);
    if (!isUuid(id)) return { ok: false, error: "Missing message." };
    if (body.length < 2) return { ok: false, fieldErrors: { body: "Write your reply." } };
    const service = createServiceClient();
    if (!service) return { ok: false, error: "Replies need SUPABASE_SERVICE_ROLE_KEY on the server." };
    const { data: m } = await ctx.supabase.from("contact_messages").select("id, name, email, subject, message, created_at").eq("id", id).maybeSingle();
    if (!m) return { ok: false, error: "That message no longer exists." };
    const settings = await getSiteSettings();
    const inbox = process.env.CONTACT_TO_EMAIL || settings.contactEmail;
    const subject = `Re: ${(m.subject as string) || "your message"}`.slice(0, 200);
    const quoted = String(m.message).split("\n").map((l) => `> ${l}`).join("\n");
    const text = `${body}\n\n—\n${settings.fullName}\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}\n\nOn ${new Date(m.created_at as string).toUTCString()}, ${m.name} wrote:\n${quoted}`;
    const from = process.env.CONTACT_FROM_EMAIL || process.env.EMAIL_FROM;
    const r = await sendEmail({ to: m.email as string, subject, text, replyTo: inbox, bcc: inbox && inbox !== m.email ? [inbox] : undefined, ...(from ? { from } : {}) }, "reply");

    const { error } = await service.from("message_replies").insert({
      message_id: id, direction: "outbound", body, subject, to_email: m.email, bcc_email: inbox ?? null, sent_by: ctx.user.id,
      status: r.sent ? "sent" : "failed", provider: r.sent ? "resend" : null, provider_message_id: r.sent ? r.id ?? null : null,
      error: r.sent ? null : r.reason,
    });
    if (error) return dbError(error, "The reply couldn't be saved. Run migration 0009.");
    if (r.sent) await service.from("contact_messages").update({ status: "replied", replied_at: new Date().toISOString(), read_at: new Date().toISOString() }).eq("id", id);
    await logActivity(ctx, r.sent ? "message replied" : "message reply failed", "contact_message", id, m.email as string);
    revalidatePath(`/admin/website/messages/${id}`);
    revalidatePath("/admin/website/messages");
    if (!r.sent) return { ok: false, error: r.reason === "not_configured" ? "Email isn't configured (RESEND_API_KEY), so the reply was NOT sent. It's saved as failed." : "The email provider didn't accept the reply. It's saved as failed; try again." };
    return { ok: true, message: `Reply sent to ${m.email}. A copy was sent to ${inbox}.` };
  });
}

export async function setConversationStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("website", async (ctx) => {
    const id = str(fd, "messageId", 40), to = str(fd, "to", 10);
    if (!isUuid(id) || !["new", "read", "replied", "archived"].includes(to)) return { ok: false, error: "That change isn't valid." };
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("contact_messages").update({
      status: to, read_at: to === "new" ? null : now, ...(to === "archived" ? { archived_at: now } : {}),
    }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath(`/admin/website/messages/${id}`);
    revalidatePath("/admin/website/messages");
    return { ok: true, message: to === "archived" ? "Archived." : to === "new" ? "Marked as unread." : "Updated." };
  });
}
