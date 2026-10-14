import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { FilterSelect } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminError } from "@/components/admin/AdminStates";
import { requirePermission } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam } from "@/lib/admin/validation";

export const metadata = { title: "AI request log" };
type Row = {
  id: string; kind: string; actor_type: string; status: string; model: string; input_tokens: number | null; output_tokens: number | null; duration_ms: number | null;
  error: string | null; created_at: string; profiles: { email: string | null } | null; courses: { title: string } | null; lessons: { title: string } | null;
};
const KINDS = ["quiz", "regenerate", "content", "lesson_assistant", "tutor", "chatbot"];

export default async function AiLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePermission("ai");
  if (!ctx) return null;
  const sp = await searchParams;
  const kind = first(sp.kind), status = first(sp.status), actor = first(sp.actor), page = pageParam(sp.page);
  let q = ctx.supabase.from("ai_generations")
    .select("id, kind, actor_type, status, model, input_tokens, output_tokens, duration_ms, error, created_at, profiles:created_by(email), courses(title), lessons(title)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (kind && KINDS.includes(kind)) q = q.eq("kind", kind);
  if (status === "succeeded" || status === "failed") q = q.eq("status", status);
  if (actor && ["admin", "student", "public"].includes(actor)) q = q.eq("actor_type", actor);
  const { data, count, error } = await q;

  return (
    <>
      <PageHeader eyebrow="AI tools" title="Request log" subtitle="Metadata for every AI request. Prompts, answers and student messages are never stored; public visitors appear only as an anonymous hash." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <FilterSelect param="kind" label="Feature" options={KINDS.map((k) => ({ value: k, label: k.replace(/_/g, " ") }))} />
        <FilterSelect param="actor" label="Who" options={[{ value: "admin", label: "Admins" }, { value: "student", label: "Students" }, { value: "public", label: "Public visitors" }]} />
        <FilterSelect param="status" label="Result" options={[{ value: "succeeded", label: "Succeeded" }, { value: "failed", label: "Failed" }]} />
      </div>
      {error ? <AdminError title="Unable to load the AI log" body="Run supabase/migrations/0006_batch2_ai.sql, then refresh." /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: kind || status || actor ? "No requests match" : "No AI requests yet", body: "Requests appear here as soon as an AI tool, the tutor or the public assistant is used." }}
            columns={[
              { key: "k", header: "Feature", primary: true, cell: (r) => <span className="font-medium capitalize">{r.kind.replace(/_/g, " ")}</span> },
              { key: "w", header: "Who", cell: (r) => (r.actor_type === "public" ? "Public visitor" : r.profiles?.email ?? (r.actor_type === "student" ? "Student" : "Admin")) },
              { key: "c", header: "Context", cell: (r) => <span className="text-ink-2">{r.lessons?.title ?? r.courses?.title ?? "–"}</span> },
              { key: "s", header: "Result", cell: (r) => <><StatusBadge status={r.status === "succeeded" ? "successful" : "failed"} />{r.error && <span className="block max-w-[16rem] truncate text-caption text-ink-3" title={r.error}>{r.error}</span>}</> },
              { key: "t", header: "Tokens", className: "tabular-nums", cell: (r) => (r.input_tokens != null ? `${r.input_tokens} / ${r.output_tokens ?? 0}` : "–") },
              { key: "d", header: "Time", className: "tabular-nums", cell: (r) => (r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "–") },
              { key: "m", header: "Model", hideOnMobile: true, cell: (r) => <span className="text-caption text-ink-3">{r.model}</span> },
              { key: "at", header: "When", cell: (r) => formatDate(r.created_at, true) },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ kind, status, actor }} />
        </>
      )}
    </>
  );
}
