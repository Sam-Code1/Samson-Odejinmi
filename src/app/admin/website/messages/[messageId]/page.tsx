import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Mail, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminForm } from "@/components/admin/AdminForm";
import { TextAreaInput } from "@/components/admin/FormFields";
import { replyToMessage, setConversationStatus } from "@/app/admin/actions/messages";
import { deleteMessage } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { formatDate, isUuid } from "@/lib/admin/validation";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Conversation" };
type Msg = { id: string; name: string; email: string; subject: string | null; service: string | null; message: string; status: string; created_at: string; notify_status?: string | null };
type Reply = { id: string; body: string; subject: string | null; direction: string; status: string; error: string | null; created_at: string; bcc_email: string | null; profiles: { email: string | null } | null };

export default async function ConversationPage({ params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  if (!isUuid(messageId)) notFound();
  const { supabase } = (await getAdminContext())!;
  const { data } = await supabase.from("contact_messages").select("*").eq("id", messageId).maybeSingle();
  if (!data) notFound();
  const m = data as Msg;
  // Opening a message marks it read.
  if (m.status === "new") await supabase.from("contact_messages").update({ status: "read", read_at: new Date().toISOString() }).eq("id", messageId);
  const [{ data: replies, error: repliesError }, { data: earlier }] = await Promise.all([
    supabase.from("message_replies").select("id, body, subject, direction, status, error, created_at, bcc_email, profiles:sent_by(email)").eq("message_id", messageId).order("created_at"),
    supabase.from("contact_messages").select("id, subject, message, created_at, status").eq("email", m.email).neq("id", messageId).order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <>
      <PageHeader eyebrow="Messages" title={m.subject || `Message from ${m.name}`}
        subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/website/messages" className="underline underline-offset-4">Inbox</Link><StatusBadge status={m.status === "new" ? "read" : m.status} /></span>} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <ol className="space-y-4">
            <li className="rounded-lg border border-line bg-elevated p-5">
              <p className="text-body-sm font-semibold">{m.name} <span className="font-normal text-ink-3">&lt;{m.email}&gt;</span></p>
              <p className="text-caption text-ink-3">{formatDate(m.created_at, true)}{m.service ? ` · ${m.service}` : ""}{m.notify_status ? ` · email notification ${m.notify_status.replace("_", " ")}` : ""}</p>
              <p className="mt-4 whitespace-pre-line break-words text-body-sm">{m.message}</p>
            </li>
            {((replies ?? []) as unknown as Reply[]).map((r) => (
              <li key={r.id} className={`rounded-lg border p-5 sm:ml-8 ${r.status === "failed" ? "border-warm/50 bg-elevated" : "border-blue/30 bg-surface/60"}`}>
                <p className="text-body-sm font-semibold">You <span className="font-normal text-ink-3">{r.profiles?.email ? `(${r.profiles.email})` : ""}</span></p>
                <p className="text-caption text-ink-3">{formatDate(r.created_at, true)} · {r.status === "sent" ? `sent${r.bcc_email ? ` · copy to ${r.bcc_email}` : ""}` : `NOT sent (${r.error ?? "failed"})`}</p>
                <p className="mt-4 whitespace-pre-line break-words text-body-sm">{r.body}</p>
              </li>
            ))}
          </ol>
          {repliesError ? <p className="text-body-sm text-warm">Replying from the dashboard needs migration 0009.</p> : (
            <Panel title={`Reply to ${m.name}`} description={emailConfigured() ? `Emailed to ${m.email}. Their answer comes back to your contact inbox (Reply-To), and you get a copy (BCC). The copy lands in your inbox, not your mail app's Sent folder.` : "Email isn't configured (RESEND_API_KEY), so replies can't be sent yet."}>
              <AdminForm action={replyToMessage} submitLabel="Send reply" stickyBar={false}>
                <input type="hidden" name="messageId" value={m.id} />
                <TextAreaInput label="Your reply" name="body" rows={8} maxLength={10000} required className="sm:col-span-2" />
              </AdminForm>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Actions">
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject ?? "your message"}`)}`} className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong px-2.5 text-caption font-semibold hover:border-ink"><Mail aria-hidden className="h-3.5 w-3.5" />Open in mail app</a>
              <ActionButton action={setConversationStatus} fields={{ messageId: m.id, to: "new" }} variant="outline">Mark unread</ActionButton>
              {m.status !== "archived" && <ActionButton action={setConversationStatus} fields={{ messageId: m.id, to: "archived" }} variant="outline"><Archive aria-hidden className="h-3.5 w-3.5" />Archive</ActionButton>}
              <ActionButton action={deleteMessage} fields={{ messageId: m.id }} variant="danger" confirm={{ title: "Delete this conversation?", body: "The message and its replies are removed permanently.", label: "Delete" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete</ActionButton>
            </div>
          </Panel>
          {(earlier ?? []).length > 0 && (
            <Panel title="Earlier messages from this person">
              <ul className="space-y-3">{((earlier ?? []) as { id: string; subject: string | null; message: string; created_at: string }[]).map((e) => (
                <li key={e.id}><Link href={`/admin/website/messages/${e.id}`} className="block text-body-sm hover:underline"><span className="block truncate font-semibold">{e.subject ?? e.message.slice(0, 60)}</span><span className="text-caption text-ink-3">{formatDate(e.created_at, true)}</span></Link></li>
              ))}</ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
