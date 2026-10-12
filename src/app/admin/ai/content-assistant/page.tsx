import { PageHeader } from "@/components/admin/PageHeader";
import { ContentAssistant } from "@/components/admin/ai/ContentAssistant";
import { getAdminContext } from "@/lib/admin/guard";
import { aiStatus } from "@/lib/ai/provider";

export const metadata = { title: "Content assistant" };
export const maxDuration = 60;

export default async function ContentAssistantPage() {
  const { supabase } = (await getAdminContext())!;
  const status = aiStatus();
  const [{ data: courses }, { data: lessons }] = await Promise.all([
    supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    supabase.from("lessons").select("id, title, course_id").order("position").limit(1000),
  ]);
  return (
    <>
      <PageHeader eyebrow="AI tools" title="Content assistant" subtitle="Drafts lesson summaries, objectives, course descriptions, glossary terms, quiz explanations and SEO descriptions from your own material. Always a draft: it never changes the site." />
      {!status.configured && (
        <div role="status" className="mb-6 rounded-lg border border-warm/40 bg-elevated p-4 text-body-sm">
          <p className="font-semibold">AI isn&apos;t configured yet</p>
          <p className="mt-1 text-ink-2">Add <code className="rounded bg-surface px-1.5 py-0.5 text-caption">{status.envVar}</code> to the server environment and restart.</p>
        </div>
      )}
      <ContentAssistant configured={status.configured} courses={(courses ?? []) as { id: string; title: string }[]} lessons={(lessons ?? []) as { id: string; title: string; course_id: string }[]} />
    </>
  );
}
