"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuleRef } from "@/lib/learning";
import { CourseSidebar } from "./CourseSidebar";

/** Mobile lesson navigation: a drawer with focus return and Escape to close. */
export function LessonDrawer({ courseSlug, modules, completed, quizzes }: { courseSlug: string; modules: ModuleRef[]; completed: string[]; quizzes?: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };

  return (
    <div className="lg:hidden">
      <button ref={btn} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="lesson-drawer" className="flex h-11 items-center gap-2 px-1 text-label">
        <span aria-hidden className="block h-3 w-4 border-y border-ink" />
        Lessons
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close lessons" onClick={close} className="absolute inset-0 bg-canvas/70 backdrop-blur-sm" />
          <div id="lesson-drawer" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Course lessons" className="absolute inset-y-0 left-0 w-[min(22rem,88vw)] overflow-y-auto border-r border-line bg-canvas p-6 outline-none">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-h4">Lessons</p>
              <button type="button" onClick={close} className="h-11 px-2 text-label text-ink-2">Close</button>
            </div>
            <CourseSidebar courseSlug={courseSlug} modules={modules} completed={completed} quizzes={quizzes} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
