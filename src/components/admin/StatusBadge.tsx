import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  published: "border-blue/40 text-blue", passed: "border-blue/40 text-blue", configured: "border-blue/40 text-blue", enrolled: "border-blue/40 text-blue", active: "border-blue/40 text-blue", successful: "border-blue/40 text-blue", approved: "border-blue/40 text-blue", valid: "border-blue/40 text-blue",
  completed: "border-violet/40 text-violet", ai_generated: "border-violet/40 text-violet", placeholder: "border-violet/40 text-violet", new: "border-blue/40 text-blue",
  pending: "border-line-strong text-ink-2", draft: "border-line-strong text-ink-2", read: "border-line-strong text-ink-2", default: "border-line text-ink-3", noindex: "border-warm/50 text-warm",
  archived: "border-line text-ink-3", revoked: "border-line text-ink-3",
  unread: "border-blue/40 text-blue", replied: "border-violet/40 text-violet",
  scheduled: "border-violet/40 text-violet", sending: "border-violet/40 text-violet", sent: "border-blue/40 text-blue", paid: "border-blue/40 text-blue",
  paused: "border-line-strong text-ink-2", waiting: "border-line-strong text-ink-2", running: "border-violet/40 text-violet", queued: "border-line-strong text-ink-2",
  suspended: "border-warm/50 text-warm", skipped: "border-line text-ink-3", bounced: "border-warm/50 text-warm", complained: "border-warm/50 text-warm",
  lead: "border-line-strong text-ink-2", customer: "border-blue/40 text-blue", student: "border-violet/40 text-violet", repeat_customer: "border-blue/40 text-blue", inactive: "border-line text-ink-3",
  failed: "border-warm/50 text-warm", not_passed: "border-warm/50 text-warm", cancelled: "border-warm/50 text-warm", refunded: "border-warm/50 text-warm", rejected: "border-warm/50 text-warm",
};

const labels: Record<string, string> = { repeat_customer: "Repeat customer", ai_generated: "AI generated", default: "Using defaults", noindex: "Hidden from search", not_passed: "Not passed", not_set: "Not set", not_enrolled: "Not enrolled" };

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-meta font-semibold capitalize", tones[status] ?? "border-line-strong text-ink-2", className)}>
      {labels[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
