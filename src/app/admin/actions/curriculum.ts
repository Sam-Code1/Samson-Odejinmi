"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, int, isUuid, optStr, parseYouTubeId, slugify, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";

function refresh(courseId: string, slug?: string) {
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/lessons");
  revalidatePath("/admin/modules");
  revalidatePath("/academy/courses");
  if (slug) revalidatePath(`/academy/courses/${slug}`);
  revalidatePath("/learn", "layout");
}

// ───────────── modules ─────────────
export async function createModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const courseId = str(fd, "courseId", 40);
    const title = str(fd, "title", 120);
    if (!isUuid(courseId)) return { ok: false, error: "Missing course." };
    if (!title) return { ok: false, fieldErrors: { title: "Module title is required." } };
    const { data: last } = await supabase.from("modules").select("position").eq("course_id", courseId).order("position", { ascending: false }).limit(1);
    const { error } = await supabase.from("modules").insert({ course_id: courseId, title, position: (last?.[0]?.position ?? 0) + 1 });
    if (error) return dbError(error);
    refresh(courseId);
    return { ok: true, message: "Module added." };
  });
}

export async function renameModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "moduleId", 40);
    const title = str(fd, "title", 120);
    if (!isUuid(id)) return { ok: false, error: "Missing module." };
    if (!title) return { ok: false, fieldErrors: { title: "Module title is required." } };
    const { data, error } = await supabase.from("modules").update({ title, description: optStr(fd, "description", 500) }).eq("id", id).select("course_id").single();
    if (error) return dbError(error);
    refresh(data.course_id);
    return { ok: true, message: "Module saved." };
  });
}

export async function setModuleStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "moduleId", 40), to = str(fd, "to", 10);
    if (!isUuid(id) || !["draft", "published"].includes(to)) return { ok: false, error: "That change isn't valid." };
    const { data, error } = await ctx.supabase.from("modules").update({ status: to }).eq("id", id).select("course_id, title").single();
    if (error || !data) return dbError(error);
    await logActivity(ctx, to === "published" ? "module published" : "module unpublished", "module", id, data.title as string);
    refresh(data.course_id as string);
    return { ok: true, message: to === "published" ? "Module published. Its published lessons are visible to students." : "Module hidden. Students won't see any of its lessons." };
  });
}

export async function deleteModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "moduleId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing module." };
    const { data: m } = await supabase.from("modules").select("course_id").eq("id", id).single();
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) return dbError(error);
    if (m) refresh(m.course_id);
    return { ok: true, message: "Module and its lessons deleted." };
  });
}

export async function moveModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "moduleId", 40);
    const dir = str(fd, "dir", 4);
    if (!isUuid(id) || !["up", "down"].includes(dir)) return { ok: false, error: "That move isn't valid." };
    const { data: m } = await supabase.from("modules").select("course_id").eq("id", id).single();
    if (!m) return { ok: false, error: "Module not found." };
    const { data: all } = await supabase.from("modules").select("id").eq("course_id", m.course_id).order("position");
    const ids = (all ?? []).map((x) => x.id as string);
    const i = ids.indexOf(id), j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const { error } = await supabase.rpc("reorder_modules", { p_course: m.course_id, p_ids: ids });
    if (error) return dbError(error);
    refresh(m.course_id);
    return { ok: true, message: "Module moved." };
  });
}

// ───────────── lessons ─────────────
type Parsed = { ok: true; patch: Record<string, unknown> } | { ok: false; fieldErrors: Record<string, string> };

function parseLesson(fd: FormData): Parsed {
  const fieldErrors: Record<string, string> = {};
  const title = str(fd, "title", 140);
  if (!title) fieldErrors.title = "Lesson title is required.";
  const slug = slugify(str(fd, "slug", 80) || title);
  if (!slug) fieldErrors.slug = "Slug is required (letters, numbers and hyphens).";

  const lesson_type = str(fd, "lesson_type", 10);
  if (!["video", "text", "mixed"].includes(lesson_type)) fieldErrors.lesson_type = "Choose a lesson type.";

  let video_provider = "none";
  let video_id: string | null = null;
  const rawVideo = str(fd, "video_input", 400);
  if (lesson_type !== "text" && rawVideo) {
    const id = parseYouTubeId(rawVideo);
    if (!id) fieldErrors.video_input = "Paste a YouTube link or the 11-character video ID. Embed code isn't accepted.";
    else { video_provider = "youtube"; video_id = id; }
  }
  const minutes = int(fd, "duration_min", 0, 0, 1000);
  const seconds = int(fd, "duration_sec", 0, 0, 59);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  return {
    ok: true,
    patch: {
      title, slug, summary: optStr(fd, "summary", 600), lesson_type, video_provider, video_id, video_enabled: bool(fd, "video_enabled"),
      duration_seconds: minutes * 60 + seconds || null, content_md: optStr(fd, "content_md", 60000), is_preview: bool(fd, "is_preview"),
    },
  };
}

export async function createLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const courseId = str(fd, "courseId", 40);
    const moduleId = str(fd, "module_id", 40);
    if (!isUuid(courseId) || !isUuid(moduleId)) return { ok: false, fieldErrors: { module_id: "Choose a module. Create one first if the course has none." } };
    const parsed = parseLesson(fd);
    if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
    const { data: mod } = await supabase.from("modules").select("course_id").eq("id", moduleId).single();
    if (!mod || mod.course_id !== courseId) return { ok: false, fieldErrors: { module_id: "That module isn't part of this course." } };
    const { data: last } = await supabase.from("lessons").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1);
    const status = str(fd, "intent", 10) === "publish" ? "published" : "draft";
    const { data, error } = await supabase.from("lessons").insert({ ...parsed.patch, course_id: courseId, module_id: moduleId, position: (last?.[0]?.position ?? 0) + 1, status }).select("id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another lesson in this course already uses that slug." } };
    if (error || !data) return dbError(error);
    refresh(courseId);
    redirect(`/admin/courses/${courseId}/lessons/${data.id}`);
  });
}

export async function saveLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const { supabase } = ctx;
    const id = str(fd, "lessonId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing lesson." };
    const parsed = parseLesson(fd);
    if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
    const intent = str(fd, "intent", 10);
    const patch: Record<string, unknown> = { ...parsed.patch };
    if (intent === "publish") patch.status = "published";
    if (intent === "unpublish") patch.status = "draft";

    const { data, error } = await supabase.from("lessons").update(patch).eq("id", id).select("course_id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another lesson in this course already uses that slug." } };
    if (error || !data) return dbError(error);
    const { error: se } = await supabase.from("lesson_sources").upsert({ lesson_id: id, transcript: optStr(fd, "transcript", 120000), notes: optStr(fd, "notes", 60000) });
    if (se) return dbError(se, "The lesson saved, but the transcript and notes didn't. Run migration 0003, then save again.");
    await logActivity(ctx, intent === "publish" ? "lesson published" : intent === "unpublish" ? "lesson unpublished" : "lesson updated", "lesson", id, String(parsed.patch.title));
    refresh(data.course_id);
    revalidatePath(`/admin/courses/${data.course_id}/lessons/${id}`);
    return { ok: true, message: intent === "publish" ? "Lesson published." : intent === "unpublish" ? "Lesson moved to draft." : "Lesson saved." };
  });
}

export async function setLessonStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "lessonId", 40);
    const to = str(fd, "to", 10);
    if (!isUuid(id) || !["draft", "published"].includes(to)) return { ok: false, error: "That change isn't valid." };
    const { data, error } = await supabase.from("lessons").update({ status: to }).eq("id", id).select("course_id").single();
    if (error || !data) return dbError(error);
    refresh(data.course_id);
    return { ok: true, message: to === "published" ? "Lesson published." : "Lesson unpublished." };
  });
}

export async function publishAllLessons(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const courseId = str(fd, "courseId", 40);
    if (!isUuid(courseId)) return { ok: false, error: "Missing course." };
    const { error } = await supabase.from("lessons").update({ status: "published" }).eq("course_id", courseId);
    if (error) return dbError(error);
    refresh(courseId);
    return { ok: true, message: "All lessons published." };
  });
}

export async function deleteLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "lessonId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing lesson." };
    const { data: l } = await supabase.from("lessons").select("course_id").eq("id", id).single();
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return dbError(error);
    if (l) refresh(l.course_id);
    if (str(fd, "redirectTo", 200).startsWith("/admin/")) redirect(str(fd, "redirectTo", 200));
    return { ok: true, message: "Lesson deleted." };
  });
}

export async function duplicateLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "lessonId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing lesson." };
    const { data: l } = await supabase.from("lessons").select("*").eq("id", id).single();
    if (!l) return { ok: false, error: "Lesson not found." };
    const { data: last } = await supabase.from("lessons").select("position").eq("module_id", l.module_id).order("position", { ascending: false }).limit(1);
    const copy = { ...l } as Record<string, unknown>;
    ["id", "created_at", "updated_at"].forEach((k) => delete copy[k]);
    Object.assign(copy, { title: `${l.title} (copy)`, slug: `${l.slug}-copy-${Math.random().toString(36).slice(2, 6)}`, position: (last?.[0]?.position ?? 0) + 1, status: "draft" });
    const { error } = await supabase.from("lessons").insert(copy);
    if (error) return dbError(error);
    refresh(l.course_id);
    return { ok: true, message: "Lesson duplicated as a draft." };
  });
}

export async function moveLesson(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "lessonId", 40);
    const dir = str(fd, "dir", 4);
    if (!isUuid(id) || !["up", "down"].includes(dir)) return { ok: false, error: "That move isn't valid." };
    const { data: l } = await supabase.from("lessons").select("module_id, course_id").eq("id", id).single();
    if (!l) return { ok: false, error: "Lesson not found." };
    const { data: all } = await supabase.from("lessons").select("id").eq("module_id", l.module_id).order("position");
    const ids = (all ?? []).map((x) => x.id as string);
    const i = ids.indexOf(id), j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const { error } = await supabase.rpc("reorder_lessons", { p_module: l.module_id, p_ids: ids });
    if (error) return dbError(error);
    refresh(l.course_id);
    return { ok: true, message: "Lesson moved." };
  });
}

export async function moveLessonToModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "lessonId", 40);
    const moduleId = str(fd, "moduleId", 40);
    if (!isUuid(id) || !isUuid(moduleId)) return { ok: false, error: "Choose a module to move the lesson to." };
    const { data: l } = await supabase.from("lessons").select("course_id").eq("id", id).single();
    const { error } = await supabase.rpc("move_lesson_to_module", { p_lesson: id, p_module: moduleId });
    if (error) return dbError(error);
    if (l) refresh(l.course_id);
    return { ok: true, message: "Lesson moved to the new module." };
  });
}
