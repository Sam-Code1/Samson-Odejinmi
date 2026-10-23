import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";

export function AdminEmpty({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="ad-card flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-ink-3"><Inbox className="h-5 w-5" strokeWidth={1.6} /></span>
      <p className="mt-4 text-[1.0625rem] font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-body-sm text-ink-3">{body}</p>}
      {action && <Link href={action.href} className="mt-5 inline-flex h-10 items-center rounded-lg bg-action px-4 text-label text-on-action hover:bg-action-hover">{action.label}</Link>}
    </div>
  );
}

export function AdminError({ title = "We couldn't load this", body }: { title?: string; body?: string }) {
  return (
    <div role="alert" className="ad-card flex items-start gap-3 border-warm/40 p-5">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warm/10 text-warm"><AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.6} /></span>
      <div className="min-w-0">
        <p className="text-label">{title}</p>
        <p className="mt-1 text-body-sm text-ink-2">{body ?? "Check your connection and refresh. If it keeps happening, make sure the database migrations have been run."}</p>
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
