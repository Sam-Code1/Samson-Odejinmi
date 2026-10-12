import Link from "next/link";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { createModule, deleteLesson, deleteModule, duplicateLesson, moveLesson, moveModule, publishAllLessons, setLessonStatus, setModuleStatus } from "@/app/admin/actions/curriculum";
import { ActionButton } from "../ActionButton";
import { AdminForm } from "../AdminForm";
import { MoveLessonForm } from "../MoveLessonForm";
import { StatusBadge } from "../StatusBadge";
import { TextInput } from "../FormFields";
import { AdminEmpty } from "../AdminStates";
import type { LessonRow, ModuleRow } from "@/lib/admin/types";

export function CurriculumTab({ courseId, modules, lessons }: { courseId: string; modules: ModuleRow[]; lessons: LessonRow[] }) {
  const byModule = new Map<string, LessonRow[]>();
  lessons.forEach((l) => byModule.set(l.module_id, [...(byModule.get(l.module_id) ?? []), l]));
  const drafts = lessons.filter((l) => l.status === "draft").length;
  const icon = "h-3.5 w-3.5";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-ink-2">{modules.length} {modules.length === 1 ? "module" : "modules"} · {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}{drafts > 0 && ` · ${drafts} draft`}</p>
        {drafts > 0 && (
          <ActionButton action={publishAllLessons} fields={{ courseId }} variant="outline" className="h-9 px-3" confirm={{ title: "Publish every lesson?", body: `${drafts} draft ${drafts === 1 ? "lesson" : "lessons"} will become visible to enrolled students.`, label: "Publish all" }}>Publish all lessons</ActionButton>
        )}
      </div>

      {modules.length === 0 && <AdminEmpty title="No modules yet" body="Add your first module below, then add lessons to it." />}

      <ol className="space-y-5">
        {modules.map((m, mi) => {
          const ls = byModule.get(m.id) ?? [];
          return (
            <li key={m.id} className="rounded-lg border border-line bg-elevated">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-caption tabular-nums text-ink-3">{String(mi + 1).padStart(2, "0")}</span>
                  <Link href={`/admin/courses/${courseId}/modules/${m.id}`} className="truncate text-admin-section hover:underline">{m.title}</Link>
                  <span className="shrink-0 text-caption text-ink-3">{ls.length} lessons</span>
                  {m.status === "draft" && <StatusBadge status="draft" />}
                </div>
                <div className="flex items-center gap-1">
                  <ActionButton action={moveModule} fields={{ moduleId: m.id, dir: "up" }} ariaLabel={`Move ${m.title} up`} title="Move up" disabled={mi === 0}><ArrowUp aria-hidden className={icon} /></ActionButton>
                  <ActionButton action={moveModule} fields={{ moduleId: m.id, dir: "down" }} ariaLabel={`Move ${m.title} down`} title="Move down" disabled={mi === modules.length - 1}><ArrowDown aria-hidden className={icon} /></ActionButton>
                  <ActionButton action={setModuleStatus} fields={{ moduleId: m.id, to: m.status === "draft" ? "published" : "draft" }} ariaLabel={m.status === "draft" ? `Publish ${m.title}` : `Hide ${m.title}`} title={m.status === "draft" ? "Publish module" : "Hide module (unpublish)"}>
                    {m.status === "draft" ? <Eye aria-hidden className={icon} /> : <EyeOff aria-hidden className={icon} />}
                  </ActionButton>
                  <Link href={`/admin/courses/${courseId}/modules/${m.id}`} aria-label={`Rename ${m.title}`} title="Rename" className="inline-flex h-8 items-center rounded px-2.5 text-ink-2 hover:bg-surface hover:text-ink"><Pencil aria-hidden className={icon} /></Link>
                  <ActionButton action={deleteModule} fields={{ moduleId: m.id }} variant="danger" ariaLabel={`Delete ${m.title}`} title="Delete module" confirm={{ title: `Delete “${m.title}”?`, body: `This permanently deletes the module and its ${ls.length} ${ls.length === 1 ? "lesson" : "lessons"}, including student progress on them.`, label: "Delete module" }}><Trash2 aria-hidden className={icon} /></ActionButton>
                </div>
              </div>

              {ls.length === 0 ? <p className="px-4 py-5 text-body-sm text-ink-3">No lessons in this module yet.</p> : (
                <ul className="divide-y divide-line">
                  {ls.map((l, li) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-5 text-caption tabular-nums text-ink-3">{li + 1}</span>
                        <Link href={`/admin/courses/${courseId}/lessons/${l.id}`} className="truncate text-body-sm font-medium hover:underline">{l.title}</Link>
                        <StatusBadge status={l.status} />
                        {l.is_preview && <span className="text-caption text-ink-3">Free preview</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <ActionButton action={moveLesson} fields={{ lessonId: l.id, dir: "up" }} ariaLabel={`Move ${l.title} up`} title="Move up" disabled={li === 0}><ArrowUp aria-hidden className={icon} /></ActionButton>
                        <ActionButton action={moveLesson} fields={{ lessonId: l.id, dir: "down" }} ariaLabel={`Move ${l.title} down`} title="Move down" disabled={li === ls.length - 1}><ArrowDown aria-hidden className={icon} /></ActionButton>
                        <MoveLessonForm lessonId={l.id} currentModuleId={m.id} modules={modules.map((x) => ({ id: x.id, title: x.title }))} />
                        <ActionButton action={setLessonStatus} fields={{ lessonId: l.id, to: l.status === "published" ? "draft" : "published" }} ariaLabel={l.status === "published" ? `Unpublish ${l.title}` : `Publish ${l.title}`} title={l.status === "published" ? "Unpublish" : "Publish"}>
                          {l.status === "published" ? <EyeOff aria-hidden className={icon} /> : <Eye aria-hidden className={icon} />}
                        </ActionButton>
                        <ActionButton action={duplicateLesson} fields={{ lessonId: l.id }} ariaLabel={`Duplicate ${l.title}`} title="Duplicate"><Copy aria-hidden className={icon} /></ActionButton>
                        <ActionButton action={deleteLesson} fields={{ lessonId: l.id }} variant="danger" ariaLabel={`Delete ${l.title}`} title="Delete lesson" confirm={{ title: `Delete “${l.title}”?`, body: "This permanently deletes the lesson and student progress on it.", label: "Delete lesson" }}><Trash2 aria-hidden className={icon} /></ActionButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-line px-4 py-2.5">
                <Link href={`/admin/courses/${courseId}/lessons/new?module=${m.id}`} className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-caption font-semibold text-blue hover:bg-surface"><Plus aria-hidden className="h-3.5 w-3.5" />Add lesson</Link>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-line bg-elevated p-5">
        <h2 className="text-admin-section">Add a module</h2>
        <AdminForm action={createModule} submitLabel="Add module" stickyBar={false} className="mt-4">
          <input type="hidden" name="courseId" value={courseId} />
          <TextInput label="Module title" name="title" placeholder="Module 7: Next steps" required />
        </AdminForm>
      </div>
    </div>
  );
}
