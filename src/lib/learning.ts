import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type LessonRef = { id: string; slug: string; position: number; title: string };
export type ModuleRef = { id: string; position: number; title: string; lessons: LessonRef[] };

export type LoadedCourse =
  | { state: "missing" }
  | { state: "locked"; course: { id: string; slug: string; title: string } }
  | {
      state: "ok";
      course: { id: string; slug: string; title: string };
      modules: ModuleRef[];
      flat: (LessonRef & { moduleTitle: string })[];
      completed: string[];
      percent: number;
      quizzes: { id: string; title: string; lesson_id: string | null }[];
    };

/** One query set per request (React cache). RLS does the real gatekeeping: no enrolment, no modules or lessons. */
export const loadCourse = cache(async (slug: string, userId: string): Promise<LoadedCourse> => {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, slug, title").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!course) return { state: "missing" };

  const { data: enrol } = await supabase.from("enrolments").select("id").eq("user_id", userId).eq("course_id", course.id).in("status", ["active", "completed"]).limit(1).maybeSingle();
  if (!enrol) return { state: "locked", course };

  const [{ data: mods }, { data: prog }, { data: qz }] = await Promise.all([
    // Draft modules (and their lessons) are hidden from students. RLS on lessons enforces the same rule.
    supabase.from("modules").select("id, position, title, status, lessons(id, slug, position, title, status)").eq("course_id", course.id).eq("status", "published").order("position"),
    supabase.from("lesson_progress").select("lesson_id").eq("user_id", userId).eq("course_id", course.id).eq("completed", true),
    supabase.from("quizzes").select("id, title, lesson_id").eq("course_id", course.id).eq("status", "published").order("created_at"),
  ]);

  type Raw = { id: string; position: number; title: string; lessons: (LessonRef & { status: string })[] | null };
  const modules: ModuleRef[] = ((mods ?? []) as unknown as Raw[]).map((m) => ({
    id: m.id,
    position: m.position,
    title: m.title,
    lessons: (m.lessons ?? []).filter((l) => l.status === "published").sort((a, b) => a.position - b.position).map(({ id, slug, position, title }) => ({ id, slug, position, title })),
  }));
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const completed = (prog ?? []).map((p) => p.lesson_id as string);
  const percent = flat.length ? (completed.filter((id) => flat.some((l) => l.id === id)).length / flat.length) * 100 : 0;
  return { state: "ok", course, modules, flat, completed, percent, quizzes: (qz ?? []) as { id: string; title: string; lesson_id: string | null }[] };
});
