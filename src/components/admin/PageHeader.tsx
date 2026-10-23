import { cn } from "@/lib/utils";

/** Page title block: eyebrow, title, a short line of context, and actions that wrap under it on small screens. */
export function PageHeader({ eyebrow, title, subtitle, actions, className }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between", className)}>
      <div className="min-w-0 xl:flex-1">
        {eyebrow && <p className="ad-label mb-2.5">{eyebrow}</p>}
        <h1 className="break-words text-admin-title">{title}</h1>
        {subtitle && <div className="mt-2.5 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-2">{subtitle}</div>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2.5 xl:shrink-0 xl:justify-end">{actions}</div>}
    </div>
  );
}

/** The card every admin section sits in. */
export function Panel({ title, description, actions, children, className, flush = false }: {
  title?: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={cn("ad-card min-w-0", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-1 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-admin-section">{title}</h2>}
            {description && <p className="mt-1 max-w-2xl text-body-sm text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "pt-3" : "p-5 sm:p-6"}>{children}</div>
    </section>
  );
}

/** A section heading between groups of cards. */
export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 mt-10 flex items-end justify-between gap-4 first:mt-0", className)}>
      <h2 className="text-admin-section">{children}</h2>
      {action}
    </div>
  );
}
