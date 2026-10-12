import { ChevronDown } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { AddAdminForm, ChangeRoleForm, RemoveAdminForm, TransferOwnershipForm } from "@/components/admin/AdminsForms";
import { setAdminStatus } from "@/app/admin/actions/admins";
import { requirePermission } from "@/lib/admin/guard";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, isAdminRole } from "@/lib/admin/roles";
import { formatDate } from "@/lib/admin/validation";

export const metadata = { title: "Admins" };
type Row = { user_id: string; role: string; status: string; created_at: string; profiles: { first_name: string; last_name: string; email: string | null } | null };

export default async function AdminsPage() {
  const ctx = await requirePermission("admins");
  if (!ctx) return null; // the admin template shows "no access"
  const { data, error } = await ctx.supabase.from("admin_users").select("user_id, role, status, created_at, profiles(first_name, last_name, email)").order("created_at");
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0));
  const label = (r: Row) => (r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() || r.profiles.email || "Admin" : "Admin");
  const candidates = rows.filter((r) => r.role !== "owner" && r.status === "active").map((r) => ({ id: r.user_id, label: `${label(r)} (${r.profiles?.email ?? ""})` }));

  return (
    <>
      <PageHeader eyebrow="System" title="Admins" subtitle="Who can use the admin, and what each person can do. Being a student, paying, or enrolling never grants admin access: only this page does." />
      {error ? <AdminError title="Unable to load admins" body="Run supabase/migrations/0005_batch1_foundation.sql, then refresh." /> : (
        <div className="space-y-8">
          <Panel title="Add an admin"><AddAdminForm inviteAvailable={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} /></Panel>

          <section aria-labelledby="team">
            <h2 id="team" className="mb-3 text-admin-section">Team ({rows.length})</h2>
            <ul className="space-y-3">
              {rows.map((r) => {
                const isOwner = r.role === "owner", isMe = r.user_id === ctx.user.id;
                return (
                  <li key={r.user_id}>
                    <details className="group rounded-lg border border-line bg-elevated open:border-line-strong">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block text-body font-semibold">{label(r)}{isMe && <span className="ml-2 text-caption font-normal text-ink-3">(you)</span>}</span>
                          <span className="block truncate text-caption text-ink-3">{r.profiles?.email} · added {formatDate(r.created_at)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-meta font-semibold">{isAdminRole(r.role) ? ROLE_LABELS[r.role] : r.role}</span>
                          <StatusBadge status={r.status === "active" ? "active" : "revoked"} />
                          {!isOwner && <ChevronDown aria-hidden className="h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" />}
                        </span>
                      </summary>
                      {isOwner ? (
                        <p className="border-t border-line px-5 py-4 text-body-sm text-ink-3">The Owner has full access. Ownership can only change through a transfer.</p>
                      ) : (
                        <div className="grid gap-6 border-t border-line px-5 pb-5 pt-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-3 text-caption text-ink-3">{isAdminRole(r.role) ? ROLE_DESCRIPTIONS[r.role] : ""}</p>
                            <ChangeRoleForm userId={r.user_id} current={r.role} />
                            <div className="mt-4">
                              {r.status === "active"
                                ? <ActionButton action={setAdminStatus} fields={{ userId: r.user_id, status: "disabled" }} variant="outline" confirm={{ title: `Disable ${label(r)}?`, body: "They immediately lose admin access. Their account still works as a normal account.", label: "Disable" }}>Disable access</ActionButton>
                                : <ActionButton action={setAdminStatus} fields={{ userId: r.user_id, status: "active" }} variant="outline">Re-enable access</ActionButton>}
                            </div>
                          </div>
                          <div className="rounded border border-warm/30 p-4"><RemoveAdminForm userId={r.user_id} /></div>
                        </div>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>

          {ctx.role === "owner" && (
            <Panel title="Transfer ownership" description="Hand full control to another admin. You'll keep Super Admin access.">
              <TransferOwnershipForm candidates={candidates} />
            </Panel>
          )}

          <Panel title="About sessions">
            <p className="text-body-sm text-ink-2">Disabling or removing an admin takes effect on their very next request, because every admin page and action re-checks the database. Supabase doesn&apos;t let an app end another user&apos;s sessions by id, so their sign-in itself stays valid as a normal (student) account until it expires.</p>
          </Panel>
        </div>
      )}
    </>
  );
}
