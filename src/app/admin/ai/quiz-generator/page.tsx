import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminError } from "@/components/admin/AdminStates";
import { QuizGenerator, type GenLesson } from "@/components/admin/ai/QuizGenerator";
import { getAdminContext } from "@/lib/admin/guard";
import { aiStatus } from "@/lib/ai/provider";
import { first, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "AI quiz generator" };
// Generation can take a while for 20 questions with explanations.
export const maxDuration = 120;

export default async function QuizGeneratorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = (await getAdminContext())!;
  const status = aiStatus();
  const [courses, modules, lessons, sources, resources, quizzes] = await Promise.all([
    supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    supabase.from("modules").select("id, title, course_id, position").order("position"),
    supabase.from("lessons").select("id, title, course_id, module_id, position, summary, content_md").order("position").limit(1000),
    supabase.from("lesson_sources").select("lesson_id, transcript, notes").limit(1000),
    supabase.from("lesson_resources").select("id, title, lesson_id, course_id, kind, mime_type, file_path").not("file_path", "is", null).limit(1000),
    supabase.from("quizzes").select("id, title, course_id, lesson_id, status").order("created_at", { ascending: false }).limit(500),
  ]);
  if (courses.error || lessons.error || sources.error) {
    return <><PageHeader eyebrow="AI tools" title="Quiz generator" /><AdminError title="Unable to load the quiz generator" body="Run the latest migration (supabase/migrations/0003_website_cms.sql), then refresh." /></>;
  }

  const src = new Map(((sources.data ?? []) as { lesson_id: string; transcript: string | null; notes: string | null }[]).map((s) => [s.lesson_id, s]));
  type Res = { id: string; title: string; lesson_id: string | null; course_id: string; kind: string; mime_type: string | null };
  const readable = ((resources.data ?? []) as Res[]).filter((r) => r.kind === "pdf" || r.mime_type === "application/pdf" || r.mime_type === "text/plain");
  const genLessons: GenLesson[] = ((lessons.data ?? []) as { id: string; title: string; course_id: string; module_id: string; summary: string | null; content_md: string | null }[]).map((l) => ({
    id: l.id, title: l.title, course_id: l.course_id, module_id: l.module_id,
    chars: {
      content: (l.summary?.length ?? 0) + (l.content_md?.length ?? 0),
      transcript: src.get(l.id)?.transcript?.length ?? 0,
      notes: src.get(l.id)?.notes?.length ?? 0,
    },
    // Lesson files first, then course-wide files.
    resources: readable.filter((r) => r.lesson_id === l.id || (r.course_id === l.course_id && !r.lesson_id)).map((r) => ({ id: r.id, title: r.title, scope: r.lesson_id ? "lesson" : "course" })),
  }));

  return (
    <>
      <PageHeader eyebrow="AI tools" title="Quiz generator"
        subtitle={<>Turn a lesson&apos;s own material into draft questions. You review, edit and approve every question. Saved questions go to the <Link href="/admin/questions" className="underline underline-offset-4">question bank</Link> as approved but <strong className="font-semibold">unpublished</strong>; nothing reaches students until you publish it.</>} />
      {!status.configured && (
        <div role="status" className="mb-6 rounded-lg border border-warm/40 bg-elevated p-4 text-body-sm">
          <p className="font-semibold">AI isn&apos;t configured yet</p>
          <p className="mt-1 text-ink-2">Add <code className="rounded bg-surface px-1.5 py-0.5 text-caption">{status.envVar}</code> to the server&apos;s environment (<code className="rounded bg-surface px-1.5 py-0.5 text-caption">.env.local</code>) and restart. The key stays on the server and is never sent to the browser.</p>
        </div>
      )}
      <QuizGenerator
        configured={status.configured} provider={status.provider} model={status.model}
        courses={(courses.data ?? []) as { id: string; title: string }[]}
        modules={(modules.data ?? []) as { id: string; title: string; course_id: string }[]}
        lessons={genLessons}
        quizzes={(quizzes.data ?? []) as { id: string; title: string; course_id: string; lesson_id: string | null; status: string }[]}
        initial={{ course: isUuid(first(sp.course)) ? first(sp.course) : undefined, lesson: isUuid(first(sp.lesson)) ? first(sp.lesson) : undefined, quiz: isUuid(first(sp.quiz)) ? first(sp.quiz) : undefined }}
      />
    </>
  );
}
