import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCourse } from "@/lib/learning";
import { setLessonComplete } from "@/app/student-actions";
import { LessonBody, type LessonData, type ResourceItem } from "@/components/learn/LessonBody";
import { CompleteButton } from "@/components/learn/CompleteButton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StateMessage } from "@/components/ui/States";

export const metadata: Metadata = { title: "Lesson", robots: { index: false, follow: false } };

/**
 * Access is verified before anything about the video is fetched: loadCourse() requires a signed-in user,
 * an active/completed enrolment and a published course; the lesson query below only returns published lessons,
 * and RLS independently enforces the same rules in the database.
 */
export default async function LessonPage({ params }: { params: Promise<{ courseSlug: string; lessonSlug: string }> }) {
  const { courseSlug, lessonSlug } = await params;
  const user = await requireUser(`/learn/${courseSlug}/${lessonSlug}`);
  const data = await loadCourse(courseSlug, user.id);
  if (data.state !== "ok") return null; // the layout explains why

  const supabase = await createClient();
  const { data: lessonRaw } = await supabase
    .from("lessons")
    .select("id, module_id, title, summary, content_md, lesson_type, video_provider, video_id, video_enabled")
    .eq("course_id", data.course.id).eq("slug", lessonSlug).eq("status", "published").maybeSingle();
  const lesson = lessonRaw as (LessonData & { module_id: string }) | null;

  if (!lesson) {
    return <StateMessage title="This lesson isn't available" body="It may have moved, or it isn't published yet." action={{ href: `/learn/${courseSlug}`, label: "Back to the course" }} />;
  }

  const { data: resRaw } = await supabase
    .from("lesson_resources").select("id, title, description, kind, url, size_bytes, download_enabled")
    .eq("course_id", data.course.id)
    .or(`lesson_id.eq.${lesson.id},and(module_id.eq.${lesson.module_id},lesson_id.is.null),and(lesson_id.is.null,module_id.is.null,quiz_id.is.null)`)
    .order("position");

  const idx = data.flat.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? data.flat[idx - 1] : null;
  const next = idx >= 0 && idx < data.flat.length - 1 ? data.flat[idx + 1] : null;
  const isDone = data.completed.includes(lesson.id);
  const doneCount = data.completed.filter((id) => data.flat.some((l) => l.id === id)).length;
  const current = data.flat[idx];
  const lessonQuizzes = data.quizzes.filter((q) => q.lesson_id === lesson.id);

  return (
    <article className="mx-auto max-w-4xl">
      <p className="text-caption text-ink-3">{data.course.title}{current ? ` · ${current.moduleTitle}` : ""}</p>
      <h1 className="mt-2 text-h1">{lesson.title}</h1>
      {lesson.summary && <p className="mt-4 max-w-prose text-body-lg text-ink-2">{lesson.summary}</p>}
      <div className="mt-5 max-w-xs">
        <ProgressBar value={data.percent} label="Course progress" />
        <p className="mt-1.5 text-caption text-ink-3">{Math.round(data.percent)}% complete · {doneCount} / {data.flat.length} lessons completed</p>
      </div>

      <LessonBody lesson={lesson} resources={(resRaw ?? []) as unknown as ResourceItem[]} quizzes={lessonQuizzes} courseSlug={courseSlug} />

      <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
        <form action={setLessonComplete}>
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <input type="hidden" name="completed" value={isDone ? "false" : "true"} />
          <CompleteButton completed={isDone} />
        </form>
        <nav aria-label="Lesson navigation" className="flex items-center gap-8 text-label">
          {prev && <Link href={`/learn/${courseSlug}/${prev.slug}`} className="text-ink-2 hover:text-ink"><span className="link-line pb-1">Previous lesson</span></Link>}
          {next ? <Link href={`/learn/${courseSlug}/${next.slug}`} className="text-ink"><span className="link-line pb-1">Next lesson</span></Link> : <Link href="/dashboard" className="text-ink"><span className="link-line pb-1">Back to dashboard</span></Link>}
        </nav>
      </div>
    </article>
  );
}
