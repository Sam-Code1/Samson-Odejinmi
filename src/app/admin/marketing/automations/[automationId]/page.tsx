import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { DataTable } from "@/components/admin/DataTable";
import { AutomationForm } from "@/components/admin/AutomationForm";
import { setAutomationStatus } from "@/app/admin/actions/marketing";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate, isUuid } from "@/lib/admin/validation";
import { validateSteps, type Step } from "@/lib/marketing/steps";

export const metadata = { title: "Automation" };
type Log = { id: string; step_index: number; action: string; outcome: string; detail: string | null; created_at: string };

export default async function AutomationPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;
  if (!isUuid(automationId)) notFound();
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const [{ data }, { data: products }, { data: courses }, { data: runs }] = await Promise.all([
    ctx.supabase.from("automations").select("*").eq("id", automationId).maybeSingle(),
    ctx.supabase.from("products").select("id, name").neq("status", "archived").order("name"),
    ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    ctx.supabase.from("automation_runs").select("id, status").eq("automation_id", automationId).limit(5000),
  ]);
  if (!data) notFound();
  const a = data as { id: string; name: string; trigger_event: string; status: string; steps: Step[] };
  const runIds = ((runs ?? []) as { id: string; status: string }[]);
  const counts = runIds.reduce<Record<string, number>>((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {});
  const { data: logs } = runIds.length
    ? await ctx.supabase.from("automation_logs").select("id, step_index, action, outcome, detail, created_at").in("run_id", runIds.slice(0, 500).map((r) => r.id)).order("created_at", { ascending: false }).limit(50)
    : { data: [] };
  const valid = validateSteps(a.steps).ok;

  return (
    <>
      <PageHeader eyebrow="Automation" title={a.name} subtitle={<span className="flex flex-wrap items-center gap-3"><Link href="/admin/marketing/automations" className="underline underline-offset-4">All automations</Link><StatusBadge status={a.status} /></span>}
        actions={a.status === "active"
          ? <ActionButton action={setAutomationStatus} fields={{ automationId, status: "paused" }} variant="outline" className="h-10 px-4 text-label">Pause</ActionButton>
          : <ActionButton action={setAutomationStatus} fields={{ automationId, status: "active" }} variant="primary" className="h-10 px-4 text-label" disabled={!valid}
              confirm={{ title: "Activate this automation?", body: "It starts for new events from now on. Emails go only to people who opted in.", label: "Activate" }}>Activate</ActionButton>} />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AutomationForm a={a} products={(products ?? []) as { id: string; name: string }[]} courses={((courses ?? []) as { id: string; title: string }[]).map((c) => ({ id: c.id, name: c.title }))} />
        <div className="space-y-6">
          <Panel title="People in this automation">
            <dl className="grid grid-cols-2 gap-3 text-body-sm">
              {["active", "waiting", "completed", "failed", "cancelled"].map((k) => (
                <div key={k}><dt className="text-caption capitalize text-ink-3">{k}</dt><dd className="text-h4 tabular-nums">{counts[k] ?? 0}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel title="Recent activity">
            <DataTable<Log> rows={(logs ?? []) as Log[]} rowKey={(r) => r.id} empty={{ title: "Nothing yet", body: "Steps appear here as people go through the automation." }}
              columns={[
                { key: "s", header: "Step", primary: true, cell: (r) => <span>{r.step_index + 1}. {r.action.replace(/_/g, " ")} <span className="text-ink-3">{r.detail ? `· ${r.detail}` : ""}</span></span> },
                { key: "o", header: "Result", cell: (r) => <StatusBadge status={r.outcome === "done" ? "completed" : r.outcome} /> },
                { key: "t", header: "When", cell: (r) => formatDate(r.created_at, true) },
              ]} />
          </Panel>
        </div>
      </div>
    </>
  );
}
