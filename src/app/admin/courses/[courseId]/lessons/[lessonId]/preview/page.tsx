import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonBody, type LessonData, type ResourceItem } from "@/components/learn/LessonBody";
import { getAdminContext } from "@/lib/admin/guard";
import { isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Lesson preview" };

/** Exactly what a student sees, rendered with the same component, for admins only. */
export default async function LessonPreview({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  if (!isUuid(courseId) || !isUuid(lessonId)) notFound();
  const { supabase } = (await getAdminContext())!;
  const [{ data: lesson }, { data: course }, { data: res }, { data: quizzes }] = await Promise.all([
    supabase.from("lessons").select("id, title, summary, content_md, lesson_type, video_provider, video_id, video_enabled, status").eq("id", lessonId).eq("course_id", courseId).maybeSingle(),
    supabase.from("courses").select("slug, title").eq("id", courseId).maybeSingle(),
    supabase.from("lesson_resources").select("id, title, description, kind, url, size_bytes, download_enabled").eq("course_id", courseId).or(`lesson_id.eq.${lessonId},and(lesson_id.is.null,module_id.is.null,quiz_id.is.null)`),
    supabase.from("quizzes").select("id, title").eq("lesson_id", lessonId).eq("status", "published"),
  ]);
  if (!lesson || !course) notFound();
  return (
    <>
      <div role="note" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue/40 bg-elevated px-4 py-3 text-body-sm">
        <span>Admin preview{lesson.status !== "published" ? " (this lesson is a draft and not visible to students)" : ""}. This is exactly what an enrolled student sees.</span>
        <Link href={`/admin/courses/${courseId}/lessons/${lessonId}`} className="font-semibold underline underline-offset-4">Back to editor</Link>
      </div>
      <article className="mx-auto max-w-4xl rounded-lg border border-line p-5 sm:p-8">
        <p className="text-caption text-ink-3">{course.title}</p>
        <h1 className="mt-2 text-h1">{lesson.title}</h1>
        {lesson.summary && <p className="mt-4 max-w-prose text-body-lg text-ink-2">{lesson.summary}</p>}
        <LessonBody lesson={lesson as unknown as LessonData} resources={(res ?? []) as unknown as ResourceItem[]} quizzes={(quizzes ?? []) as QuizLinkRow[]} courseSlug={course.slug} />
      </article>
    </>
  );
}
type QuizLinkRow = { id: string; title: string };
