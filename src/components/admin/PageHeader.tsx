import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, subtitle, actions, className }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-meta font-semibold uppercase tracking-wider text-ink-3">{eyebrow}</p>}
        <h1 className="text-admin-title">{title}</h1>
        {subtitle && <div className="mt-2 max-w-2xl text-[0.9375rem] text-ink-2 sm:text-base">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-line bg-elevated", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-admin-section">{title}</h2>}
            {description && <p className="mt-1 text-body-sm text-ink-3">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
