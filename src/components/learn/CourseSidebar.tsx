"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ModuleRef } from "@/lib/learning";
import { cn } from "@/lib/utils";

export function CourseSidebar({ courseSlug, modules, completed, quizzes = [], onNavigate }: { courseSlug: string; modules: ModuleRef[]; completed: string[]; quizzes?: { id: string; title: string }[]; onNavigate?: () => void }) {
  const params = useParams<{ lessonSlug?: string }>();
  const done = new Set(completed);
  return (
    <nav aria-label="Course lessons">
      <ol className="space-y-8">
        {modules.map((m) => (
          <li key={m.id}>
            <p className="text-label text-ink-3">{m.position}. {m.title}</p>
            <ul className="mt-3 border-l border-line">
              {m.lessons.map((l) => {
                const active = params.lessonSlug === l.slug;
                const isDone = done.has(l.id);
                return (
                  <li key={l.id}>
                    <Link href={`/learn/${courseSlug}/${l.slug}`} onClick={onNavigate} aria-current={active ? "page" : undefined}
                      className={cn("relative flex min-h-11 items-start gap-3 py-2 pl-4 pr-2 text-body-sm transition-colors", active ? "text-ink" : "text-ink-2 hover:text-ink")}>
                      {active && <span aria-hidden className="thread-v absolute -left-px top-0 h-full w-px" />}
                      <span aria-hidden className={cn("mt-[0.45em] h-2.5 w-2.5 shrink-0 rounded-full border", isDone ? "border-transparent bg-blue" : "border-line-strong")} />
                      <span>{l.title}{isDone && <span className="sr-only"> (completed)</span>}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {quizzes.length > 0 && (
          <li>
            <p className="text-label text-ink-3">Quizzes</p>
            <ul className="mt-3 border-l border-line">
              {quizzes.map((q) => (
                <li key={q.id}><Link href={`/learn/${courseSlug}/quiz/${q.id}`} onClick={onNavigate} className="flex min-h-11 items-center py-2 pl-4 pr-2 text-body-sm text-ink-2 hover:text-ink">{q.title}</Link></li>
              ))}
            </ul>
          </li>
        )}
      </ol>
    </nav>
  );
}
