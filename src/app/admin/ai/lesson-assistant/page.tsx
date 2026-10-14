import { PageHeader } from "@/components/admin/PageHeader";
import { LessonAssistant } from "@/components/admin/ai/LessonAssistant";
import { requirePermission } from "@/lib/admin/guard";
import { aiStatus } from "@/lib/ai/provider";
import { first, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Lesson assistant" };
export const maxDuration = 60;

export default async function LessonAssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("ai");
  if (!ctx) return null;
  const sp = await searchParams;
  const status = aiStatus();
  const [{ data: courses }, { data: modules }, { data: lessons }] = await Promise.all([
    ctx.supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    ctx.supabase.from("modules").select("id, title, course_id").order("position"),
    ctx.supabase.from("lessons").select("id, title, course_id, module_id").order("position").limit(1000),
  ]);
  const lesson = first(sp.lesson);
  return (
    <>
      <PageHeader eyebrow="AI tools" title="Lesson assistant" subtitle="Ask for objectives, summaries, exercises, glossary terms or improvements for a specific lesson. It works from that lesson's own material, and everything it writes is a draft for you to review." />
      {!status.configured && (
        <div role="status" className="mb-6 rounded-lg border border-warm/40 bg-elevated p-4 text-body-sm">
          <p className="font-semibold">AI isn&apos;t configured yet</p>
          <p className="mt-1 text-ink-2">Add <code className="rounded bg-surface px-1.5 py-0.5 text-caption">{status.envVar}</code> to the server environment and redeploy.</p>
        </div>
      )}
      <LessonAssistant configured={status.configured}
        courses={(courses ?? []) as { id: string; title: string }[]}
        modules={(modules ?? []) as { id: string; title: string; course_id: string }[]}
        lessons={(lessons ?? []) as { id: string; title: string; course_id: string; module_id: string }[]}
        initialLesson={isUuid(lesson) ? lesson : undefined} />
    </>
  );
}
