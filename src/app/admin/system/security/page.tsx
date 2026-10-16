import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { formatDate } from "@/lib/admin/validation";

export const metadata = { title: "Security" };
export const dynamic = "force-dynamic";
type Ev = { id: number; kind: string; email_hint: string | null; email_hash: string | null; ip_hash: string | null; detail: string | null; created_at: string };
type Log = { id: string; actor_email: string | null; action: string; resource_label: string | null; created_at: string };
type Hook = { id: number; provider: string; event: string | null; outcome: string; received_at: string };
type Session = { user_hint: string; is_admin: boolean; sessions: number; last_seen: string | null };

const KIND: Record<string, string> = {
  login_success: "Signed in", login_failed: "Failed sign-in", signup: "New account", password_reset_requested: "Password reset requested", password_changed: "Password changed",
  admin_stepup_success: "Admin confirmed password", admin_stepup_failed: "Admin password check failed", webhook_rejected: "Webhook rejected", rate_limited: "Rate limited",
};
const device = (h: string | null) => (h ? `#${h.slice(0, 6)}` : "–"); // short, irreversible network fingerprint

/** Security centre ("activity" permission). Emails are masked; IPs are shown only as short hashes. */
export default async function SecurityPage() {
  const ctx = await requirePermission("activity");
  if (!ctx) return null;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: events, error }, { data: logs }, { data: hooks }, sessions] = await Promise.all([
    ctx.supabase.from("security_events").select("id, kind, email_hint, email_hash, ip_hash, detail, created_at").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("activity_logs").select("id, actor_email, action, resource_label, created_at").not("actor_id", "is", null).order("created_at", { ascending: false }).limit(25),
    ctx.supabase.from("webhook_events").select("id, provider, event, outcome, received_at").order("received_at", { ascending: false }).limit(25),
    ctx.can("admins") ? ctx.supabase.rpc("admin_active_sessions") : Promise.resolve({ data: null }),
  ]);
  if (error) return <><PageHeader eyebrow="System" title="Security" /><AdminError title="The security log needs migration 0009" body="Run supabase/migrations/0009_batch4_finalization.sql, then refresh." /></>;
  const ev = (events ?? []) as Ev[];
  const recent = ev.filter((e) => e.created_at >= since);
  const failed24 = recent.filter((e) => e.kind === "login_failed");
  const byEmail = new Map<string, { hint: string; n: number }>();
  failed24.forEach((e) => { if (!e.email_hash) return; const m = byEmail.get(e.email_hash) ?? { hint: e.email_hint ?? "•••", n: 0 }; m.n++; byEmail.set(e.email_hash, m); });
  const flagged = [...byEmail.values()].filter((v) => v.n >= 5);
  const masked = (e: Ev) => e.email_hint ?? "–";

  return (
    <>
      <PageHeader eyebrow="System" title="Security" subtitle="Sign-ins, failed sign-ins, password events, admin activity, sessions and webhook checks. Email addresses are masked and network addresses are only stored as hashes." />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sign-ins (24h)" value={recent.filter((e) => e.kind === "login_success").length} />
        <StatCard label="Failed sign-ins (24h)" value={failed24.length} hint={flagged.length ? `${flagged.length} account(s) with 5+ failures` : undefined} />
        <StatCard label="Rejected webhooks (24h)" value={recent.filter((e) => e.kind === "webhook_rejected").length} />
        <StatCard label="Admin password checks failed (24h)" value={recent.filter((e) => e.kind === "admin_stepup_failed").length} />
      </div>
      {flagged.length > 0 && <p className="mb-6 rounded-lg border border-warm/50 bg-elevated px-4 py-3 text-body-sm">Repeated failed sign-ins in the last 24 hours: {flagged.map((f) => `${f.hint} (${f.n})`).join(", ")}. Supabase Auth rate-limits these attempts; if it continues, consider asking the person to reset their password.</p>}
      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 text-admin-section">Recent security events</h2>
          <DataTable<Ev> rows={ev.slice(0, 40)} rowKey={(r) => String(r.id)} empty={{ title: "No events yet", body: "Sign-ins and other security events appear here from now on." }}
            columns={[
              { key: "k", header: "Event", primary: true, cell: (r) => <span className={r.kind.includes("failed") || r.kind === "webhook_rejected" ? "text-warm" : ""}>{KIND[r.kind] ?? r.kind}</span> },
              { key: "w", header: "Who", cell: (r) => masked(r) },
              { key: "d", header: "Network", hideOnMobile: true, cell: (r) => <span className="font-mono text-caption">{device(r.ip_hash)}</span> },
              { key: "t", header: "When", cell: (r) => formatDate(r.created_at, true) },
            ]} />
        </section>
        <div className="space-y-8">
          {ctx.can("admins") && (
            <Panel title="Active sessions" description="Signed-in browsers per account (from Supabase Auth). Emails masked.">
              {((sessions as { data: Session[] | null }).data ?? []).length === 0 ? <p className="text-body-sm text-ink-3">No session data available.</p> : (
                <ul className="divide-y divide-line">{((sessions as { data: Session[] }).data).map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-body-sm"><span className="min-w-0 truncate">{s.user_hint}{s.is_admin && <span className="ml-2 text-caption text-violet">admin</span>}</span><span className="shrink-0 text-caption text-ink-3">{s.sessions} · {s.last_seen ? formatDate(s.last_seen, true) : "–"}</span></li>
                ))}</ul>
              )}
            </Panel>
          )}
          <Panel title="Webhook deliveries">
            {(hooks ?? []).length === 0 ? <p className="text-body-sm text-ink-3">None received yet.</p> : (
              <ul className="divide-y divide-line">{((hooks ?? []) as Hook[]).map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-body-sm"><span className="min-w-0 truncate capitalize">{h.provider} · {h.event ?? "–"}</span><span className="flex shrink-0 items-center gap-2"><StatusBadge status={h.outcome === "processed" ? "completed" : h.outcome === "ignored" ? "skipped" : "failed"} /><span className="text-caption text-ink-3">{formatDate(h.received_at, true)}</span></span></li>
              ))}</ul>
            )}
          </Panel>
          <Panel title="Recent admin activity">
            <ul className="divide-y divide-line">{((logs ?? []) as Log[]).map((l) => (
              <li key={l.id} className="py-2.5 text-body-sm"><span className="font-semibold">{l.action}</span>{l.resource_label ? <span className="text-ink-2"> · {l.resource_label}</span> : null}<span className="block text-caption text-ink-3">{l.actor_email ?? "System"} · {formatDate(l.created_at, true)}</span></li>
            ))}</ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
