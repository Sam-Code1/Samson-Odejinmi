"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ModuleRef } from "@/lib/learning";
import { cn } from "@/lib/utils";

/**
 * The syllabus as a vertical Pathway (§16): each lesson is a node on the line: hollow (to do), filled blue (done),
 * violet with a halo (you are here); the course ends in the square (the project).
 */
export function CourseSidebar({ courseSlug, modules, completed, quizzes = [], onNavigate }: { courseSlug: string; modules: ModuleRef[]; completed: string[]; quizzes?: { id: string; title: string }[]; onNavigate?: () => void }) {
  const params = useParams<{ lessonSlug?: string }>();
  const done = new Set(completed);
  const lastId = modules.at(-1)?.lessons.at(-1)?.id;
  let n = 0;
  return (
    <nav aria-label="Course lessons">
      <ol className="space-y-7">
        {modules.map((m) => (
          <li key={m.id}>
            <p className="fa-label">Module {String(m.position).padStart(2, "0")}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{m.title}</p>
            <ul className="relative mt-3">
              <span aria-hidden className="absolute bottom-4 left-[5px] top-4 w-px bg-line" />
              {m.lessons.map((l) => {
                n++;
                const active = params.lessonSlug === l.slug;
                const isDone = done.has(l.id);
                const isLast = l.id === lastId;
                return (
                  <li key={l.id}>
                    <Link href={`/learn/${courseSlug}/${l.slug}`} onClick={onNavigate} aria-current={active ? "page" : undefined}
                      className={cn("relative flex min-h-[40px] items-start gap-3 rounded-[4px] py-2 pr-2 text-sm transition-colors", active ? "font-semibold text-ink" : "text-ink-2 hover:text-ink")}>
                      <span aria-hidden className={cn("relative z-10 mt-[0.3em] h-[11px] w-[11px] shrink-0",
                        isLast ? (isDone ? "bg-[rgb(var(--path-end))]" : "border-[1.5px] border-line-strong bg-canvas")
                          : active ? "rounded-full bg-node shadow-[0_0_0_4px_rgb(var(--node)/0.22)]"
                            : isDone ? "rounded-full bg-[rgb(var(--path-start))]" : "rounded-full border-[1.5px] border-line-strong bg-canvas")} />
                      <span className="mt-[0.05em] font-mono text-[0.7rem] text-ink-3">{String(n).padStart(2, "0")}</span>
                      <span className="min-w-0">{l.title}{isDone && <span className="sr-only"> (completed)</span>}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {quizzes.length > 0 && (
          <li>
            <p className="fa-label">Quizzes</p>
            <ul className="mt-3 space-y-1">
              {quizzes.map((q) => (
                <li key={q.id}><Link href={`/learn/${courseSlug}/quiz/${q.id}`} onClick={onNavigate} className="flex min-h-[40px] items-center gap-3 rounded-[4px] py-2 text-sm text-ink-2 hover:text-ink"><span aria-hidden className="h-[11px] w-[11px] shrink-0 rotate-45 border-[1.5px] border-line-strong" />{q.title}</Link></li>
              ))}
            </ul>
          </li>
        )}
      </ol>
    </nav>
  );
}
