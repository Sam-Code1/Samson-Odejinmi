import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LessonForm } from "@/components/admin/LessonForm";
import { ResourceList } from "@/components/admin/ResourceList";
import { ActionButton } from "@/components/admin/ActionButton";
import { deleteLesson } from "@/app/admin/actions/curriculum";
import { getAdminContext } from "@/lib/admin/guard";
import { getLibraryImages } from "@/lib/admin/media";
import { isUuid } from "@/lib/admin/validation";
import type { LessonRow, ResourceRow } from "@/lib/admin/types";

export const metadata = { title: "Edit lesson" };

export default async function EditLesson({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  if (!isUuid(courseId) || !isUuid(lessonId)) notFound();
  const ctx = (await getAdminContext())!;
  const { supabase } = ctx;
  const library = await getLibraryImages(ctx);

  const [{ data: lessonRaw }, { data: modules }, { data: all }, { data: res }, { data: quizzes }, { data: sources }] = await Promise.all([
    supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", courseId).maybeSingle(),
    supabase.from("modules").select("id, title, position").eq("course_id", courseId).order("position"),
    supabase.from("lessons").select("id, title, module_id, position").eq("course_id", courseId),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("created_at", { ascending: false }),
    supabase.from("quizzes").select("id, title, status").eq("lesson_id", lessonId),
    supabase.from("lesson_sources").select("transcript, notes").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  if (!lessonRaw) notFound();
  const lesson = lessonRaw as unknown as LessonRow;
  const mods = (modules ?? []) as { id: string; title: string; position: number }[];

  const order = new Map(mods.map((m) => [m.id, m.position]));
  const flat = ((all ?? []) as { id: string; title: string; module_id: string; position: number }[]).sort((a, b) => (order.get(a.module_id) ?? 0) - (order.get(b.module_id) ?? 0) || a.position - b.position);
  const i = flat.findIndex((l) => l.id === lessonId);
  const prev = i > 0 ? flat[i - 1] : null, next = i >= 0 && i < flat.length - 1 ? flat[i + 1] : null;
  const base = `/admin/courses/${courseId}`;
  const mod = mods.find((m) => m.id === lesson.module_id);

  return (
    <>
      <PageHeader eyebrow={mod?.title ?? "Lesson"} title={lesson.title} subtitle={<Link href={`${base}?tab=curriculum`} className="underline underline-offset-4">Back to curriculum</Link>}
        actions={<><StatusBadge status={lesson.status} /><Link href={`${base}/lessons/${lessonId}/preview`} className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink"><Eye aria-hidden className="h-4 w-4" />Preview as student</Link></>} />
      <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
        <LessonForm courseId={courseId} modules={mods} lesson={lesson} sources={sources as { transcript: string | null; notes: string | null } | null} library={library} />
        <div className="space-y-6">
          <Panel title="Navigate">
            <div className="flex flex-col gap-2 text-body-sm">
              {prev ? <Link href={`${base}/lessons/${prev.id}`} className="inline-flex items-center gap-2 text-ink-2 hover:text-ink"><ArrowLeft aria-hidden className="h-4 w-4 shrink-0" /><span className="truncate">{prev.title}</span></Link> : <span className="text-ink-3">First lesson</span>}
              {next ? <Link href={`${base}/lessons/${next.id}`} className="inline-flex items-center gap-2 text-ink-2 hover:text-ink"><ArrowRight aria-hidden className="h-4 w-4 shrink-0" /><span className="truncate">{next.title}</span></Link> : <span className="text-ink-3">Last lesson</span>}
            </div>
          </Panel>
          <Panel title="Resources" actions={<Link href={`${base}?tab=resources`} className="inline-flex items-center gap-1 text-caption font-semibold text-blue"><Plus aria-hidden className="h-3.5 w-3.5" />Add</Link>}>
            <ResourceList resources={(res ?? []) as unknown as ResourceRow[]} lessons={[{ id: lessonId, title: lesson.title }]} />
          </Panel>
          <Panel title="AI quiz" description="Generate draft questions from this lesson's text, transcript and notes.">
            <Link href={`/admin/ai/quiz-generator?course=${courseId}&lesson=${lessonId}`} className="inline-flex h-9 items-center gap-2 rounded border border-line-strong px-3 text-label hover:border-ink">Open quiz generator</Link>
          </Panel>
          <Panel title="Quizzes" actions={<Link href={`/admin/quizzes/new?course=${courseId}&lesson=${lessonId}`} className="inline-flex items-center gap-1 text-caption font-semibold text-blue"><Plus aria-hidden className="h-3.5 w-3.5" />Create</Link>}>
            {(quizzes ?? []).length === 0 ? <p className="text-body-sm text-ink-3">No quiz for this lesson.</p> : (
              <ul className="space-y-2">{(quizzes ?? []).map((q) => <li key={q.id as string} className="flex items-center justify-between gap-2 text-body-sm"><Link href={`/admin/quizzes/${q.id}`} className="truncate hover:underline">{q.title as string}</Link><StatusBadge status={q.status as string} /></li>)}</ul>
            )}
          </Panel>
          <Panel title="Danger zone">
            <ActionButton action={deleteLesson} fields={{ lessonId, redirectTo: `${base}?tab=curriculum` }} variant="danger" className="h-9 px-3" confirm={{ title: `Delete “${lesson.title}”?`, body: "This permanently deletes the lesson and student progress on it.", label: "Delete lesson" }}><Trash2 aria-hidden className="h-3.5 w-3.5" />Delete lesson</ActionButton>
          </Panel>
        </div>
      </div>
    </>
  );
}
