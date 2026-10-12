import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
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

/** The learner's lesson content: video, notes, resources, quizzes. Used by the student page and the admin preview. */
export function LessonBody({ lesson, resources, quizzes, courseSlug }: { lesson: LessonData; resources: ResourceItem[]; quizzes: QuizLink[]; courseSlug: string }) {
  const showVideo = lesson.lesson_type !== "text";
  return (
    <>
      {showVideo && (
        <div className="mt-8">
          {lesson.video_thumbnail && lesson.video_id && lesson.video_enabled
            ? <VideoPoster thumbnail={lesson.video_thumbnail} title={lesson.title}><VideoPlayer provider={lesson.video_provider} id={lesson.video_id} title={lesson.title} enabled={lesson.video_enabled} autoplay /></VideoPoster>
            : <VideoPlayer provider={lesson.video_provider} id={lesson.video_id} title={lesson.title} enabled={lesson.video_enabled} />}
        </div>
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-[1fr_18rem]">
        <div className="max-w-prose">
          {lesson.content_md ? <LessonText text={lesson.content_md} /> : <p className="text-body text-ink-3">{lesson.lesson_type === "text" ? "The written lesson is still being prepared." : "The written notes for this lesson are still being prepared."}</p>}
          {quizzes.length > 0 && (
            <section aria-labelledby="quiz-h" className="mt-12 border-t border-line pt-8">
              <h2 id="quiz-h" className="text-h4">Test your understanding</h2>
              <ul className="mt-4 space-y-2">
                {quizzes.map((q) => <li key={q.id}><Link href={`/learn/${courseSlug}/quiz/${q.id}`} className="text-label"><span className="link-line pb-1">{q.title}</span></Link></li>)}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="res-h" className="xl:border-l xl:border-line xl:pl-8">
          <h2 id="res-h" className="text-label text-ink-3">Resources</h2>
          {resources.length === 0 ? <p className="mt-3 text-body-sm text-ink-3">No resources for this lesson.</p> : (
            <ul className="mt-3 space-y-4">
              {resources.map((r) => (
                <li key={r.id} className="text-body-sm">
                  {r.kind === "link" && r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 hover:underline"><ExternalLink aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.5} /><span>{r.title}</span></a>
                  ) : r.download_enabled ? (
                    <a href={`/api/resources/${r.id}`} className="inline-flex items-start gap-2 hover:underline"><Download aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-blue" strokeWidth={1.5} /><span>{r.title}<span className="block text-caption text-ink-3">{r.kind.toUpperCase()}{r.size_bytes ? ` · ${formatBytes(r.size_bytes)}` : ""}</span></span></a>
                  ) : (
                    <span className="inline-flex items-start gap-2 text-ink-3"><FileText aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />{r.title}</span>
                  )}
                  {r.description && <p className="mt-1 pl-6 text-caption text-ink-3">{r.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
