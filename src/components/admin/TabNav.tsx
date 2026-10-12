import Link from "next/link";
import { cn } from "@/lib/utils";

export function TabNav({ tabs, current, basePath }: { tabs: { key: string; label: string }[]; current: string; basePath: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-8 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const on = t.key === current;
          return (
            <li key={t.key}>
              <Link href={`${basePath}?tab=${t.key}`} aria-current={on ? "page" : undefined} className={cn("relative block whitespace-nowrap py-3 text-label transition-colors", on ? "text-ink" : "text-ink-3 hover:text-ink")}>
                {t.label}
                {on && <span aria-hidden className="thread-solid absolute inset-x-0 -bottom-px h-0.5" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
