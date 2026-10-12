"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, isUuid, optStr, str } from "@/lib/admin/validation";
import { IMAGE_KINDS, isFile, uploadImage, uploadResourceFile, type ImageKind } from "@/lib/admin/storage";

function refresh(courseId?: string) {
  revalidatePath("/admin/resources");
  revalidatePath("/admin/media");
  if (courseId) revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/learn", "layout");
}

/** Attach a downloadable file or an external link to a course, module, lesson or quiz. */
export async function uploadResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const courseId = str(fd, "courseId", 40);
    if (!isUuid(courseId)) return { ok: false, fieldErrors: { courseId: "Choose a course." } };
    const title = str(fd, "title", 140);
    if (!title) return { ok: false, fieldErrors: { title: "Resource title is required." } };

    const lessonId = str(fd, "lesson_id", 40), moduleId = str(fd, "module_id", 40), quizId = str(fd, "quiz_id", 40);
    const target: Record<string, string | null> = { lesson_id: null, module_id: null, quiz_id: null };
    if (isUuid(lessonId)) {
      const { data } = await ctx.supabase.from("lessons").select("course_id").eq("id", lessonId).single();
      if (data?.course_id !== courseId) return { ok: false, fieldErrors: { lesson_id: "That lesson isn't in this course." } };
      target.lesson_id = lessonId;
    } else if (isUuid(moduleId)) {
      const { data } = await ctx.supabase.from("modules").select("course_id").eq("id", moduleId).single();
      if (data?.course_id !== courseId) return { ok: false, fieldErrors: { module_id: "That module isn't in this course." } };
      target.module_id = moduleId;
    } else if (isUuid(quizId)) {
      const { data } = await ctx.supabase.from("quizzes").select("course_id").eq("id", quizId).single();
      if (data?.course_id !== courseId) return { ok: false, fieldErrors: { quiz_id: "That quiz isn't in this course." } };
      target.quiz_id = quizId;
    }

    const base = { course_id: courseId, title, description: optStr(fd, "description", 400), download_enabled: bool(fd, "download_enabled"), ...target };

    if (str(fd, "mode", 6) === "link") {
      const url = str(fd, "url", 600);
      let ok = false;
      try { const u = new URL(url); ok = u.protocol === "https:" || u.protocol === "http:"; } catch { /* invalid */ }
      if (!ok) return { ok: false, fieldErrors: { url: "Enter a full link starting with https://" } };
      const { error } = await ctx.supabase.from("lesson_resources").insert({ ...base, kind: "link", url });
      if (error) return dbError(error);
    } else {
      const file = fd.get("file");
      if (!isFile(file)) return { ok: false, fieldErrors: { file: "Choose a file to upload." } };
      const up = await uploadResourceFile(ctx, file, courseId);
      if (!up.ok) return { ok: false, fieldErrors: { file: up.error } };
      const { error } = await ctx.supabase.from("lesson_resources").insert({ ...base, kind: up.kind, file_path: up.path, size_bytes: up.size, mime_type: up.mime });
      if (error) { await ctx.supabase.storage.from("course-resources").remove([up.path]); return dbError(error); }
    }
    refresh(courseId);
    return { ok: true, message: "Resource uploaded." };
  });
}

export async function toggleResourceDownload(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "resourceId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing resource." };
    const on = str(fd, "enabled", 5) === "yes";
    const { data, error } = await supabase.from("lesson_resources").update({ download_enabled: on }).eq("id", id).select("course_id").single();
    if (error) return dbError(error);
    refresh(data?.course_id);
    return { ok: true, message: on ? "Download enabled." : "Download disabled." };
  });
}

export async function deleteResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "resourceId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing resource." };
    const { data: r } = await supabase.from("lesson_resources").select("file_path, course_id").eq("id", id).single();
    const { error } = await supabase.from("lesson_resources").delete().eq("id", id);
    if (error) return dbError(error);
    if (r?.file_path) await supabase.storage.from("course-resources").remove([r.file_path]);
    refresh(r?.course_id);
    return { ok: true, message: "Resource deleted." };
  });
}

export async function uploadMedia(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const fail = (key: string, message: string): ActionResult => ({ ok: false, fieldErrors: { [key]: message } });
    const file = fd.get("file");
    if (!isFile(file)) return fail("file", "Choose an image to upload.");
    const kind = str(fd, "kind", 20);
    if (!(kind in IMAGE_KINDS)) return fail("kind", "Choose what this image is for.");
    const courseId = str(fd, "course_id", 40);
    const alt = optStr(fd, "alt_text", 200);
    const up = await uploadImage(ctx, file, kind as ImageKind, { ...(isUuid(courseId) ? { course_id: courseId } : {}), ...(alt ? { alt_text: alt } : {}) });
    if (!up.ok) return fail("file", up.error);
    refresh();
    return { ok: true, message: "Image uploaded." };
  });
}

export async function deleteMedia(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "mediaId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing image." };
    const { data: m } = await supabase.from("media_assets").select("bucket, path").eq("id", id).single();
    const { error } = await supabase.from("media_assets").delete().eq("id", id);
    if (error) return dbError(error);
    if (m) await supabase.storage.from(m.bucket).remove([m.path]);
    refresh();
    return { ok: true, message: "Image deleted." };
  });
}
