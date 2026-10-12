import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { LessonForm } from "@/components/admin/LessonForm";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { first, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "New lesson" };

export default async function NewLesson({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { courseId } = await params;
  if (!isUuid(courseId)) notFound();
  const sp = await searchParams;
  const ctx = (await getAdminContext())!;
  const { supabase } = ctx;
  const library = await getLibraryImages(ctx);
  const [{ data: course }, { data: modules }] = await Promise.all([
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("id, title").eq("course_id", courseId).order("position"),
  ]);
  if (!course) notFound();
  return (
    <>
      <PageHeader eyebrow={course.title} title="New lesson" subtitle={<Link href={`/admin/courses/${courseId}?tab=curriculum`} className="underline underline-offset-4">Back to curriculum</Link>} />
      <div className="max-w-4xl"><LessonForm courseId={courseId} modules={(modules ?? []) as { id: string; title: string }[]} defaultModuleId={first(sp.module)} library={library} /></div>
    </>
  );
}
