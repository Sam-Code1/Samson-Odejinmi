"use client";

import { startTransition, useActionState } from "react";
import { moveLessonToModule } from "@/app/admin/actions/curriculum";
import { initialResult } from "@/lib/admin/result";
import { useResultToast } from "./useResultToast";

/** Moves a lesson to another module of the same course. Accessible alternative to drag-and-drop. */
export function MoveLessonForm({ lessonId, currentModuleId, modules }: { lessonId: string; currentModuleId: string; modules: { id: string; title: string }[] }) {
  const [state, dispatch, pending] = useActionState(moveLessonToModule, initialResult);
  useResultToast(state);
  if (modules.length < 2) return null;
  return (
    <form onChange={(e) => { const fd = new FormData(e.currentTarget); if (fd.get("moduleId")) startTransition(() => dispatch(fd)); }} onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <label className="sr-only" htmlFor={`mv-${lessonId}`}>Move lesson to module</label>
      <select id={`mv-${lessonId}`} name="moduleId" defaultValue="" disabled={pending} className="h-8 max-w-[10rem] rounded border border-line-strong bg-canvas px-2 text-caption text-ink-2 focus:outline-none focus:ring-2 focus:ring-blue/30">
        <option value="" disabled>Move to…</option>
        {modules.filter((m) => m.id !== currentModuleId).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </form>
  );
}
