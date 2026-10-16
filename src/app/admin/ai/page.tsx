import Link from "next/link";
import { BookOpenCheck, FileText, ListChecks, MessageCircle, PenLine, ScrollText } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { aiStatus } from "@/lib/ai/provider";
import { AI_FEATURES, PUBLIC_DAILY_CAP, modelFor, type AiFeature } from "@/lib/ai/config";
import { learnerAiEnabled } from "@/lib/ai/usage";

export const metadata = { title: "AI tools" };

const LABELS: Record<AiFeature, string> = {
  quiz: "Quiz generator", regenerate: "Question regenerate", content: "Content assistant", lesson_assistant: "Lesson assistant", tutor: "Student tutor", chatbot: "Public assistant", marketing: "Marketing assistant",
};
type Row = { kind: AiFeature; status: string; input_tokens: number | null; output_tokens: number | null; duration_ms: number | null; created_at: string };

const tools = [
  { href: "/admin/ai/quiz-generator", title: "Quiz generator", body: "Turn a lesson's material into draft questions you review and approve.", icon: ListChecks },
  { href: "/admin/ai/lesson-assistant", title: "Lesson assistant", body: "Objectives, summaries, exercises and improvements for a specific lesson.", icon: BookOpenCheck },
  { href: "/admin/ai/content-assistant", title: "Content assistant", body: "Course descriptions, SEO descriptions, glossaries and explanations.", icon: PenLine },
  { href: "/admin/ai/logs", title: "Request log", body: "Every AI request: who, which feature, model, tokens, time and result.", icon: ScrollText },
];

export default async function AiOverviewPage() {
  const ctx = await requirePermission("ai");
  if (!ctx) return null;
  const status = aiStatus();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await ctx.supabase.from("ai_generations").select("kind, status, input_tokens, output_tokens, duration_ms, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  const rows = (data ?? []) as Row[];
  const day = Date.now() - 86_400_000;
  const by = new Map<AiFeature, { n: number; failed: number; inT: number; outT: number; dur: number[]; today: number }>();
  rows.forEach((r) => {
    const m = by.get(r.kind) ?? { n: 0, failed: 0, inT: 0, outT: 0, dur: [], today: 0 };
    m.n++; if (r.status !== "succeeded") m.failed++;
    m.inT += r.input_tokens ?? 0; m.outT += r.output_tokens ?? 0;
    if (r.duration_ms) m.dur.push(r.duration_ms);
    if (+new Date(r.created_at) > day) m.today++;
    by.set(r.kind, m);
  });
  const total = rows.length, failed = rows.filter((r) => r.status !== "succeeded").length;
  const tokens = rows.reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  const fmt = (n: number) => n.toLocaleString("en");

  return (
    <>
      <PageHeader eyebrow="AI tools" title="AI" subtitle="Assistants that work from your own course material. Everything they produce for the Academy is a draft until you approve it; students and visitors only ever read answers, never change content." />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Requests (30 days)" value={fmt(total)} hint={total ? `${failed} failed` : "No requests yet"} href="/admin/ai/logs" />
        <StatCard label="Tokens (30 days)" value={fmt(tokens)} hint="Input + output, as reported by the provider" />
        <StatCard label="Provider" value={status.configured ? "Connected" : "Not configured"} hint={status.configured ? status.provider : `Set ${status.envVar}`} />
        <StatCard label="Tutor + public assistant" value={learnerAiEnabled() ? "On" : "Off"} hint={learnerAiEnabled() ? "Visible to students and visitors" : "Needs ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY"} />
      </div>

      <ul className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((t) => (
          <li key={t.href}>
            <Link href={t.href} className="group block h-full rounded-lg border border-line bg-elevated p-5 transition-colors hover:border-line-strong">
              <t.icon aria-hidden className="h-5 w-5 text-violet" strokeWidth={1.5} />
              <p className="mt-4 text-body font-semibold">{t.title}</p>
              <p className="mt-1 text-body-sm text-ink-3">{t.body}</p>
            </Link>
          </li>
        ))}
      </ul>

      {error ? <AdminError title="Unable to load AI usage" body="Run supabase/migrations/0006_batch2_ai.sql, then refresh." /> : (
        <Panel title="Usage by feature" description="Last 30 days. Message text is never stored: only metadata.">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[40rem] text-left text-body-sm">
              <thead><tr className="border-b border-line text-caption text-ink-3">
                <th className="py-2 pr-4 font-semibold">Feature</th><th className="py-2 pr-4 font-semibold">Requests</th><th className="py-2 pr-4 font-semibold">Last 24h</th>
                <th className="py-2 pr-4 font-semibold">Failed</th><th className="py-2 pr-4 font-semibold">Tokens in / out</th><th className="py-2 pr-4 font-semibold">Median time</th><th className="py-2 font-semibold">Limit</th>
              </tr></thead>
              <tbody>
                {(Object.keys(LABELS) as AiFeature[]).map((f) => {
                  const m = by.get(f);
                  const med = m?.dur.length ? [...m.dur].sort((a, b) => a - b)[Math.floor(m.dur.length / 2)] : null;
                  const c = AI_FEATURES[f];
                  return (
                    <tr key={f} className="border-b border-line last:border-0">
                      <td className="py-3 pr-4"><span className="font-medium">{LABELS[f]}</span><span className="block text-caption text-ink-3">{modelFor(f)}</span></td>
                      <td className="py-3 pr-4 tabular-nums">{m?.n ?? 0}</td>
                      <td className="py-3 pr-4 tabular-nums">{m?.today ?? 0}</td>
                      <td className="py-3 pr-4 tabular-nums">{m?.failed ? <StatusBadge status="failed" /> : 0}</td>
                      <td className="py-3 pr-4 tabular-nums">{m ? `${fmt(m.inT)} / ${fmt(m.outT)}` : "–"}</td>
                      <td className="py-3 pr-4 tabular-nums">{med ? `${(med / 1000).toFixed(1)}s` : "–"}</td>
                      <td className="py-3 text-caption text-ink-3">{c.limit} per {c.windowMinutes >= 1440 ? "day" : "hour"} per {f === "chatbot" ? "visitor" : f === "tutor" ? "student" : "admin"}{f === "chatbot" ? `, ${PUBLIC_DAILY_CAP}/day total` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <p className="mt-6 flex items-center gap-2 text-caption text-ink-3"><MessageCircle aria-hidden className="h-3.5 w-3.5" />The student tutor appears on lesson pages; the public assistant appears on Academy pages. <FileText aria-hidden className="ml-2 h-3.5 w-3.5" />Limits and models are set in src/lib/ai/config.ts and AI_MODEL_* env vars.</p>
    </>
  );
}
