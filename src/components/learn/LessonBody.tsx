import Link from "next/link";
import { ArrowRight, Download, ExternalLink, FileText } from "lucide-react";
import { VideoPlayer, type VideoProvider } from "./VideoPlayer";
import { VideoPoster } from "./VideoPoster";
import { LessonText } from "./LessonText";
import { formatBytes } from "@/lib/admin/validation";

export type LessonData = {
  id: string; title: string; summary: string | null; content_md: string | null; lesson_type: "video" | "text" | "mixed";
  video_provider: VideoProvider; video_id: string | null; video_enabled: boolean; video_thumbnail?: string | null;
};
export type ResourceItem = { id: string; title: string; description: string | null; kind: string; url: string | null; size_bytes: number | null; download_enabled: boolean };
export type QuizLink = { id: string; title: string };

/**
 * The learner's lesson content (student page and admin preview). §16 course player: video always on Night; notes in
 * book-body at reading width; resources and exercises in a side panel on surface-raised.
 */
export function LessonBody({ lesson, resources, quizzes, courseSlug }: { lesson: LessonData; resources: ResourceItem[]; quizzes: QuizLink[]; courseSlug: string }) {
  const showVideo = lesson.lesson_type !== "text";
  return (
    <>
      {showVideo && (
        <div className="theme-night mt-8 overflow-hidden rounded-[8px] border border-line bg-canvas">
          {lesson.video_thumbnail && lesson.video_id && lesson.video_enabled
            ? <VideoPoster thumbnail={lesson.video_thumbnail} title={lesson.title}><VideoPlayer provider={lesson.video_provider} id={lesson.video_id} title={lesson.title} enabled={lesson.video_enabled} autoplay /></VideoPoster>
            : <VideoPlayer provider={lesson.video_provider} id={lesson.video_id} title={lesson.title} enabled={lesson.video_enabled} />}
        </div>
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="max-w-[68ch]">
          <p className="fa-label mb-5">Notes</p>
          {lesson.content_md ? <LessonText text={lesson.content_md} /> : <p className="text-body text-ink-3">{lesson.lesson_type === "text" ? "The written lesson is still being prepared." : "The written notes for this lesson are still being prepared."}</p>}
        </div>

        <aside className="space-y-6">
          {quizzes.length > 0 && (
            <section aria-labelledby="quiz-h" className="fa-card bg-elevated p-5">
              <h2 id="quiz-h" className="fa-label">Check yourself</h2>
              <ul className="mt-3 space-y-1">
                {quizzes.map((q) => (
                  <li key={q.id}><Link href={`/learn/${courseSlug}/quiz/${q.id}`} className="flex min-h-[40px] items-center justify-between gap-3 text-sm font-medium text-blue hover:underline">{q.title}<ArrowRight aria-hidden className="h-4 w-4 shrink-0" /></Link></li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="res-h" className="fa-card bg-elevated p-5">
            <h2 id="res-h" className="fa-label">Resources</h2>
            {resources.length === 0 ? <p className="mt-3 text-body-sm text-ink-3">No resources for this lesson.</p> : (
              <ul className="mt-3 divide-y divide-line">
                {resources.map((r) => (
                  <li key={r.id} className="py-3 text-sm first:pt-1 last:pb-0">
                    {r.kind === "link" && r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2.5 hover:text-blue"><ExternalLink aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.5} /><span>{r.title}</span></a>
                    ) : r.download_enabled ? (
                      <a href={`/api/resources/${r.id}`} className="inline-flex items-start gap-2.5 hover:text-blue"><Download aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-blue" strokeWidth={1.5} /><span>{r.title}<span className="mt-0.5 block font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink-3">{r.kind}{r.size_bytes ? ` · ${formatBytes(r.size_bytes)}` : ""}</span></span></a>
                    ) : (
                      <span className="inline-flex items-start gap-2.5 text-ink-3"><FileText aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />{r.title}</span>
                    )}
                    {r.description && <p className="mt-1 pl-[1.6rem] text-caption text-ink-3">{r.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
