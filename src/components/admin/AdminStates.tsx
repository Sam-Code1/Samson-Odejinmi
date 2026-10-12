import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function AdminEmpty({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="text-h4">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-body-sm text-ink-3">{body}</p>}
      {action && <Link href={action.href} className="mt-5 inline-flex h-10 items-center rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90">{action.label}</Link>}
    </div>
  );
}

export function AdminError({ title = "We couldn't load this", body }: { title?: string; body?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-warm/40 bg-elevated p-5">
      <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warm" strokeWidth={1.5} />
      <div>
        <p className="text-label">{title}</p>
        <p className="mt-1 text-body-sm text-ink-2">{body ?? "Check your connection and refresh. If it keeps happening, make sure both database migrations have been run."}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
