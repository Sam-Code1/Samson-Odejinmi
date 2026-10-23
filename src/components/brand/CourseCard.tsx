import Image from "next/image";
import Link from "next/link";
import { canOptimize } from "@/lib/cms/images";
import { cn } from "@/lib/utils";
import { Progress } from "./Brand";

/**
 * Subject icons from the brand set (§09): 24×24 grid, 1.5px stroke, round caps/joins, at most one filled node marking
 * the idea at the centre of the object.
 */
export function SubjectIcon({ subject, className }: { subject: string | null; className?: string }) {
  const s = (subject ?? "").toLowerCase();
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {/design|type|typography/.test(s) ? (
        <><path d="M4 18c3-0 4-12 8-12s5 12 8 12" {...common} /><rect x="2.5" y="16.5" width="3" height="3" {...common} /><rect x="18.5" y="16.5" width="3" height="3" {...common} /><circle cx="12" cy="6" r="1.4" fill="rgb(var(--node))" /></>
      ) : /tech|code|procedural|program/.test(s) ? (
        <><rect x="6" y="6" width="12" height="12" rx="2" {...common} /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" {...common} /><circle cx="12" cy="12" r="1.6" fill="rgb(var(--node))" /></>
      ) : /video|animation|film|motion/.test(s) ? (
        <><rect x="3" y="5" width="18" height="14" rx="2" {...common} /><path d="M10 9l5 3-5 3z" {...common} /><circle cx="12" cy="12" r="0.01" fill="rgb(var(--node))" /></>
      ) : (
        <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" {...common} /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" {...common} /><circle cx="12" cy="12" r="1.6" fill="rgb(var(--node))" /></>
      )}
    </svg>
  );
}

export type CourseCardData = {
  slug: string; title: string; subtitle?: string | null; level?: string | null; category?: string | null; imageUrl?: string | null;
  lessonCount?: number; moduleCount?: number; estimatedDuration?: string | null;
};

/** Course card (§16): numbered art panel, tags, title, mono facts; optional progress and a custom href. */
export function CourseCard({ c, index = 0, progress, href, cta }: { c: CourseCardData; index?: number; progress?: number; href?: string; cta?: string }) {
  const facts = [c.lessonCount ? `${c.lessonCount} lesson${c.lessonCount === 1 ? "" : "s"}` : null, c.moduleCount ? `${c.moduleCount} module${c.moduleCount === 1 ? "" : "s"}` : null, c.estimatedDuration].filter(Boolean);
  return (
    <article className="fa-card fa-card-hover group relative flex h-full flex-col overflow-hidden">
      <div className={cn("relative aspect-[16/10] border-b border-line", !c.imageUrl && "fa-dots")}>
        {c.imageUrl
          ? <Image src={c.imageUrl} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" unoptimized={!canOptimize(c.imageUrl)} className="object-cover" />
          : <div className="absolute inset-0 grid place-items-center text-ink"><SubjectIcon subject={c.category ?? c.title} className="h-14 w-14 transition-transform duration-[480ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1" /></div>}
        <span className="fa-label absolute left-4 top-4">Course {String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {(c.level || c.category) && (
          <div className="flex flex-wrap gap-2">{c.level && <span className="fa-tag" data-dot>{c.level}</span>}{c.category && <span className="fa-tag">{c.category}</span>}</div>
        )}
        <h3 className="mt-4 text-h4"><Link href={href ?? `/academy/courses/${c.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{c.title}</Link></h3>
        {c.subtitle && <p className="mt-2 line-clamp-2 text-body-sm text-ink-2">{c.subtitle}</p>}
        <div className="mt-auto pt-5">
          {progress !== undefined && <Progress value={progress} label={`${c.title} progress`} className="mb-4" />}
          <p className="text-caption text-ink-3">{progress !== undefined ? `${Math.round(progress * 100)}% complete${cta ? ` · ${cta}` : ""}` : facts.join(" · ")}</p>
        </div>
      </div>
    </article>
  );
}
