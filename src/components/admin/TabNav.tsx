import Link from "next/link";
import { cn } from "@/lib/utils";

/** Section tabs as a segmented control; scrolls sideways on small screens instead of overflowing. */
export function TabNav({ tabs, current, basePath }: { tabs: { key: string; label: string }[]; current: string; basePath: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-8 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" data-scroll>
      <ul className="inline-flex min-w-max gap-1 rounded-xl border border-line bg-surface/60 p-1">
        {tabs.map((t) => {
          const on = t.key === current;
          return (
            <li key={t.key}>
              <Link href={`${basePath}?tab=${t.key}`} aria-current={on ? "page" : undefined}
                className={cn("block whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.84rem] font-semibold transition-colors", on ? "bg-elevated text-ink shadow-[var(--ad-shadow)]" : "text-ink-3 hover:text-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
