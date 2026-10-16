import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatCard } from "@/components/admin/StatCard";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminForm } from "@/components/admin/AdminForm";
import { TextInput } from "@/components/admin/FormFields";
import { EmailCampaignForm, type EmailRow } from "@/components/admin/EmailForms";
import { cancelEmailCampaign, scheduleEmailCampaign, sendEmailCampaignNow, sendTestEmail, unscheduleEmailCampaign } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, isUuid } from "@/lib/admin/validation";
import { describeDefinition } from "@/lib/marketing/segments";
import { personalise, renderBodyHtml } from "@/lib/email/marketing";
import { emailConfigured } from "@/lib/email";
import { pct } from "@/lib/admin/marketing-stats";

export const metadata = { title: "Email campaign" };

export default async function EmailCampaignPage({ params }: { params: Promise<{ emailId: string }> }) {
  const { emailId } = await params;
  if (!isUuid(emailId)) notFound();
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data }, { data: segs }, { data: camps }] = await Promise.all([
    ctx.supabase.from("email_campaigns").select("*").eq("id", emailId).maybeSingle(),
    ctx.supabase.from("segments").select("id, name, definition").order("name"),
    ctx.supabase.from("marketing_campaigns").select("id, name").neq("status", "archived").order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const e = data as EmailRow & { scheduled_at: string | null; sent_at: string | null; started_at: string | null; recipients_count: number; ai_assisted: boolean };
  const editable = ["draft", "scheduled"].includes(e.status);

  // Delivery numbers: counted from this campaign's own message rows.
  let m: Record<string, number> = {};
  if (!editable) {
    const head = (f: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => f(base()).then((r) => r.count ?? 0);
    function base() { return ctx!.supabase.from("email_messages").select("id", { count: "exact", head: true }).eq("campaign_id", emailId); }
    const [queued, sent, failed, skipped, delivered, opened, clicked, bounced, unsub] = await Promise.all([
      head((q) => q.in("status", ["queued", "sending"])), head((q) => q.eq("status", "sent")), head((q) => q.eq("status", "failed")), head((q) => q.eq("status", "skipped")),
      head((q) => q.not("delivered_at", "is", null)), head((q) => q.not("opened_at", "is", null)), head((q) => q.not("clicked_at", "is", null)),
      head((q) => q.not("bounced_at", "is", null)), head((q) => q.not("unsubscribed_at", "is", null)),
    ]);
    m = { queued, sent, failed, skipped, delivered, opened, clicked, bounced, unsub };
  }
  const segment = ((segs ?? []) as { id: string; name: string; definition: unknown }[]).find((s) => s.id === e.segment_id);
  const audience = segment ? `Saved audience “${segment.name}”: ${describeDefinition(segment.definition as never)}` : describeDefinition(e.audience);

  return (
    <>
      <PageHeader eyebrow="Email" title={e.name}
        subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/marketing/email" className="underline underline-offset-4">All emails</Link><StatusBadge status={e.status} />{e.ai_assisted && <span className="text-caption">AI-assisted draft</span>}</span>} />

      {!editable && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Recipients" value={e.recipients_count} hint={e.started_at ? `Started ${formatDate(e.started_at, true)}` : undefined} />
          <StatCard label="Sent" value={m.sent} hint={`${m.queued} queued · ${m.failed} failed · ${m.skipped} skipped`} />
          <StatCard label="Delivered" value={m.delivered} hint={pct(m.delivered, m.sent)} />
          <StatCard label="Opened" value={m.opened} hint={pct(m.opened, m.sent)} />
          <StatCard label="Clicked" value={m.clicked} hint={pct(m.clicked, m.sent)} />
          <StatCard label="Bounced" value={m.bounced} />
          <StatCard label="Unsubscribed" value={m.unsub} />
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {editable
            ? <EmailCampaignForm e={e} segments={(segs ?? []) as { id: string; name: string }[]} campaigns={(camps ?? []) as { id: string; name: string }[]} />
            : <Panel title={e.subject} description={audience}><div className="max-w-none text-body-sm text-ink-2" dangerouslySetInnerHTML={{ __html: renderBodyHtml(personalise(e.body, "Ada")) }} /></Panel>}
        </div>
        <div className="space-y-6">
          {editable && (
            <Panel title="Preview" description="With “Ada” as the first name. The unsubscribe footer is added when sending.">
              <p className="mb-3 text-body-sm font-semibold">{personalise(e.subject, "Ada")}</p>
              <div className="max-h-96 overflow-y-auto text-body-sm text-ink-2" dangerouslySetInnerHTML={{ __html: renderBodyHtml(personalise(e.body, "Ada")) }} />
            </Panel>
          )}
          <Panel title="Send">
            {!emailConfigured() && <p className="mb-4 text-body-sm text-warm">Set RESEND_API_KEY to send.</p>}
            <p className="mb-4 text-caption text-ink-3">Audience: {audience}</p>
            {editable ? (
              <div className="space-y-5">
                <ActionButton action={sendTestEmail} fields={{ emailId }} variant="outline" className="h-10 w-full px-4 text-label">Send me a test</ActionButton>
                <ActionButton action={sendEmailCampaignNow} fields={{ emailId }} variant="primary" className="h-10 w-full px-4 text-label"
                  confirm={{ title: "Send this email now?", body: "It goes to everyone in the audience who has opted in. This can't be undone.", label: "Send now" }}>Send now</ActionButton>
                <div className="border-t border-line pt-5">
                  {e.status === "scheduled" ? (
                    <div className="space-y-3">
                      <p className="text-body-sm">Scheduled for <strong>{formatDate(e.scheduled_at, true)}</strong> (UTC).</p>
                      <ActionButton action={unscheduleEmailCampaign} fields={{ emailId }} variant="outline">Back to draft</ActionButton>
                    </div>
                  ) : (
                    <AdminForm action={scheduleEmailCampaign} submitLabel="Schedule" stickyBar={false}>
                      <input type="hidden" name="emailId" value={emailId} />
                      <TextInput label="Send at (UTC)" name="scheduled_at" type="datetime-local" required hint="It goes out on the first marketing run after this time." />
                    </AdminForm>
                  )}
                </div>
              </div>
            ) : e.status === "sending" ? (
              <ActionButton action={cancelEmailCampaign} fields={{ emailId }} variant="danger" confirm={{ title: "Stop sending?", body: "Emails already sent stay sent. The rest won't go out.", label: "Stop" }}>Stop sending</ActionButton>
            ) : <p className="text-body-sm text-ink-2">{e.status === "sent" ? `Sent ${formatDate(e.sent_at, true)}.` : "Cancelled."}</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
