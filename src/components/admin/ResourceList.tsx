import { Download, FileText, Link2, Trash2 } from "lucide-react";
import { deleteResource, toggleResourceDownload } from "@/app/admin/actions/resources";
import { ActionButton } from "./ActionButton";
import { AdminEmpty } from "./AdminStates";
import type { ResourceRow } from "@/lib/admin/types";
import { formatBytes } from "@/lib/admin/validation";

type Opt = { id: string; title: string };

export function ResourceList({ resources, lessons = [], modules = [], quizzes = [] }: { resources: ResourceRow[]; lessons?: Opt[]; modules?: Opt[]; quizzes?: Opt[] }) {
  if (resources.length === 0) return <AdminEmpty title="No resources yet" body="Upload a PDF, a ZIP of project files or a cheat sheet to give students something to download." />;
  const label = (r: ResourceRow) => r.lesson_id ? `Lesson: ${lessons.find((l) => l.id === r.lesson_id)?.title ?? "—"}` : r.module_id ? `Module: ${modules.find((m) => m.id === r.module_id)?.title ?? "—"}` : r.quiz_id ? `Quiz: ${quizzes.find((q) => q.id === r.quiz_id)?.title ?? "—"}` : "Whole course";
  return (
    <ul className="divide-y divide-line">
      {resources.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-3">
            {r.kind === "link" ? <Link2 aria-hidden className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.5} /> : <FileText aria-hidden className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.5} />}
            <div className="min-w-0"><p className="truncate text-body-sm font-medium">{r.title}</p><p className="truncate text-caption text-ink-3">{label(r)} · {r.kind.toUpperCase()}{r.size_bytes ? ` · ${formatBytes(r.size_bytes)}` : ""}</p></div>
          </div>
          <div className="flex items-center gap-1">
            {r.kind !== "link" && (
              <ActionButton action={toggleResourceDownload} fields={{ resourceId: r.id, enabled: r.download_enabled ? "no" : "yes" }} variant="ghost" title={r.download_enabled ? "Disable download" : "Enable download"}>
                <Download aria-hidden className="h-3.5 w-3.5" />{r.download_enabled ? "Download on" : "Download off"}
              </ActionButton>
            )}
            <ActionButton action={deleteResource} fields={{ resourceId: r.id }} variant="danger" ariaLabel={`Delete ${r.title}`} title="Delete" confirm={{ title: `Delete “${r.title}”?`, body: "The resource and its file are removed for everyone.", label: "Delete resource" }}><Trash2 aria-hidden className="h-3.5 w-3.5" /></ActionButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
