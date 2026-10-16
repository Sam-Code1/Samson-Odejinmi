import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";
import { getWhatsAppProvider } from "@/lib/whatsapp";

export const metadata = { title: "WhatsApp" };
type Msg = { id: string; kind: string; template: string | null; status: string; created_at: string; error: string | null };

export default async function WhatsAppPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const provider = getWhatsAppProvider();
  const [{ data: msgs, error }, optIns] = await Promise.all([
    ctx.supabase.from("whatsapp_messages").select("id, kind, template, status, created_at, error").order("created_at", { ascending: false }).limit(50),
    ctx.can("customers") ? ctx.supabase.from("contacts").select("id", { count: "exact", head: true }).eq("whatsapp_opt_in", true) : Promise.resolve({ count: null }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="WhatsApp" subtitle="Foundation for WhatsApp messaging through an official provider. Nothing is sent unless a provider is configured and the person has opted in to WhatsApp; delivery status comes only from the provider." />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Provider" value={provider ? provider.name : "Not configured"} />
        {optIns.count != null && <StatCard label="Opted in to WhatsApp" value={optIns.count} />}
        <StatCard label="Messages logged" value={(msgs ?? []).length} />
      </div>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <h2 className="mb-4 text-admin-section">Recent messages</h2>
          {error ? <p className="text-body-sm text-ink-3">Run migration 0008 to enable the WhatsApp log.</p> : (
            <DataTable<Msg> rows={(msgs ?? []) as Msg[]} rowKey={(r) => r.id} empty={{ title: "No WhatsApp messages yet", body: "Messages appear here once a provider is configured and something is sent." }}
              columns={[
                { key: "t", header: "Template", primary: true, cell: (r) => r.template ?? "–" },
                { key: "k", header: "Kind", cell: (r) => <span className="capitalize">{r.kind}</span> },
                { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status === "read" || r.status === "delivered" ? "completed" : r.status} /> },
                { key: "d", header: "When", cell: (r) => formatDate(r.created_at, true) },
              ]} />
          )}
        </section>
        <Panel title="Set up (Meta WhatsApp Cloud API)">
          <ol className="list-decimal space-y-2 pl-5 text-body-sm text-ink-2">
            <li>Create a WhatsApp Business app in Meta for Developers and add a phone number.</li>
            <li>Create and get approval for message templates (WhatsApp requires templates for business-initiated messages).</li>
            <li>Set <code>WHATSAPP_PROVIDER=meta</code>, <code>WHATSAPP_ACCESS_TOKEN</code>, <code>WHATSAPP_PHONE_NUMBER_ID</code>, <code>WHATSAPP_APP_SECRET</code> and <code>WHATSAPP_VERIFY_TOKEN</code> in Vercel.</li>
            <li>Webhook URL: <code className="break-all">/api/webhooks/whatsapp</code> (subscribe to message status).</li>
            <li>Collect opt-in explicitly (a WhatsApp checkbox on a form) before messaging anyone.</li>
          </ol>
        </Panel>
      </div>
    </>
  );
}
