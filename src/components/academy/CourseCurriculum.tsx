import type { PublicCourse } from "@/lib/academy";

/** Curriculum as native disclosure elements: accessible, no client JS. Titles only: never video, text or files. */
export function CourseCurriculum({ course, openFirst = true }: { course: PublicCourse; openFirst?: boolean }) {
  return (
    <div className="border-t border-line">
      {course.modules.map((m, i) => (
        <details key={m.position} open={openFirst && i === 0} className="group border-b border-line">
          <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_1fr_auto] items-center gap-4 py-6 [&::-webkit-details-marker]:hidden">
            <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-h4">{m.title}</span>
            <span className="flex items-center gap-5 text-caption text-ink-3">
              <span>{m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}</span>
              <span aria-hidden className="relative h-3.5 w-3.5">
                <span className="absolute left-0 top-1/2 h-px w-3.5 bg-ink" />
                <span className="absolute left-1/2 top-0 h-3.5 w-px bg-ink transition-transform duration-base ease-quiet group-open:scale-y-0" />
              </span>
            </span>
          </summary>
          <ol className="pb-7 pl-[3.5rem]">
            {m.lessons.map((l) => <li key={l.title} className="py-2 text-body-sm text-ink-2">{l.title}</li>)}
          </ol>
        </details>
      ))}
    </div>
  );
}
