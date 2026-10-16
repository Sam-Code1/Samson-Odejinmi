import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requirePermission } from "@/lib/admin/guard";
import { runHealthChecks, type HealthState } from "@/lib/admin/health";
import { cn } from "@/lib/utils";

export const metadata = { title: "System health" };
export const dynamic = "force-dynamic";

const STATE: Record<HealthState, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  connected: { label: "Connected", icon: CheckCircle2, cls: "text-blue" },
  degraded: { label: "Degraded", icon: CircleAlert, cls: "text-violet" },
  disconnected: { label: "Disconnected", icon: CircleX, cls: "text-warm" },
};

export default async function HealthPage() {
  const ctx = await requirePermission("settings");
  if (!ctx) return null;
  const checks = await runHealthChecks(ctx);
  const worst = checks.some((c) => c.state === "disconnected") ? "disconnected" : checks.some((c) => c.state === "degraded") ? "degraded" : "connected";
  return (
    <>
      <PageHeader eyebrow="System" title="System health" subtitle="Live checks of the services the site depends on, run when this page loads. Only the state is shown, never keys or responses. Refresh to check again." />
      <p className={cn("mb-6 text-body-sm", STATE[worst].cls)}>{worst === "connected" ? "Everything checked is connected." : worst === "degraded" ? "Some services need attention." : "Some services are not connected (some may simply not be set up yet)."}</p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map((c) => {
          const s = STATE[c.state];
          return (
            <li key={c.id} className="rounded-lg border border-line bg-elevated p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-body font-semibold">{c.label}</p>
                <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-caption font-semibold", s.cls)}><s.icon aria-hidden className="h-4 w-4" />{s.label}</span>
              </div>
              <p className="mt-2 text-body-sm text-ink-2">{c.note}</p>
              {c.ms != null && <p className="mt-1 text-caption text-ink-3">{c.ms} ms</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
