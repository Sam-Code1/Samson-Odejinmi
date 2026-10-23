import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCourse } from "@/lib/learning";
import { setLessonComplete } from "@/app/student-actions";
import { LessonBody, type LessonData, type ResourceItem } from "@/components/learn/LessonBody";
import { CompleteButton } from "@/components/learn/CompleteButton";
import { Progress } from "@/components/brand/Brand";
import { TutorLauncher } from "@/components/ai/TutorLauncher";
import { learnerAiEnabled } from "@/lib/ai/usage";

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
    .select("id, module_id, title, summary, content_md, lesson_type, video_provider, video_id, video_enabled, video_thumbnail")
    .eq("course_id", data.course.id).eq("slug", lessonSlug).eq("status", "published").maybeSingle();
  const lesson = lessonRaw as (LessonData & { module_id: string }) | null;

  if (!lesson) {
    return (
      <div className="fa-callout mx-auto max-w-xl">
        <p className="fa-label !text-blue">Not available</p>
        <p className="mt-2 text-h4">This lesson isn&apos;t available</p>
        <p className="mt-2 text-body text-ink-2">It may have moved, or it isn&apos;t published yet.</p>
        <Link href={`/learn/${courseSlug}`} className="fa-btn fa-btn-secondary mt-6">Back to the course</Link>
      </div>
    );
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
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <article className="mx-auto max-w-5xl">
      <p className="fa-label">Lesson {pad(idx + 1)} of {pad(data.flat.length)}{current ? ` · ${current.moduleTitle}` : ""}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <h1 className="text-h2">{lesson.title}</h1>
        {learnerAiEnabled() && <TutorLauncher courseSlug={courseSlug} lessonSlug={lessonSlug} lessonTitle={lesson.title} />}
      </div>
      {lesson.summary && <p className="mt-4 max-w-prose text-body-lg text-ink-2">{lesson.summary}</p>}
      <div className="mt-5 flex max-w-sm items-center gap-4">
        <Progress value={data.percent / 100} label="Course progress" className="flex-1" />
        <p className="shrink-0 text-caption text-ink-3">{doneCount} / {data.flat.length}</p>
      </div>

      <LessonBody lesson={lesson} resources={(resRaw ?? []) as unknown as ResourceItem[]} quizzes={lessonQuizzes} courseSlug={courseSlug} />

      <div className="mt-14 flex flex-col gap-6 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <form action={setLessonComplete}>
          <input type="hidden" name="lessonId" value={lesson.id} />
          <input type="hidden" name="courseSlug" value={courseSlug} />
          <input type="hidden" name="completed" value={isDone ? "false" : "true"} />
          <CompleteButton completed={isDone} />
        </form>
        <nav aria-label="Lesson navigation" className="flex flex-wrap items-center gap-3">
          {prev && <Link href={`/learn/${courseSlug}/${prev.slug}`} className="fa-btn fa-btn-secondary"><ArrowLeft aria-hidden className="h-4 w-4" />Previous</Link>}
          {next
            ? <Link href={`/learn/${courseSlug}/${next.slug}`} className="fa-btn fa-btn-primary">Next lesson<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
            : <Link href="/dashboard" className="fa-btn fa-btn-primary">Back to my learning</Link>}
        </nav>
      </div>
    </article>
  );
}
