"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/app/auth-actions";
import { notifyNewCertificates } from "@/lib/certificates";

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const first = String(fd.get("first_name") ?? "").trim().slice(0, 80);
  const last = String(fd.get("last_name") ?? "").trim().slice(0, 80);
  if (!first || !last) return { error: "Enter your first and last name." };
  const supabase = await createClient();
  // RLS limits this to the signed-in user's own row, and column grants limit it to these two fields.
  const { error } = await supabase.from("profiles").update({ first_name: first, last_name: last }).eq("id", user.id);
  if (error) return { error: "We couldn't save that. Try again." };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { message: "Saved." };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use a password with at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password. Try a different one." };
  return { message: "Password updated." };
}

/** Marks a lesson complete/incomplete. The lesson is re-read through RLS, so only enrolled students can touch it. */
export async function setLessonComplete(fd: FormData): Promise<void> {
  const user = await requireUser();
  const lessonId = String(fd.get("lessonId") ?? "");
  const courseSlug = String(fd.get("courseSlug") ?? "");
  const completed = fd.get("completed") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return;

  const supabase = await createClient();
  // Only published lessons the student can see (RLS: enrolled + published module). Progress % is computed by the database.
  const { data: lesson } = await supabase.from("lessons").select("id, course_id").eq("id", lessonId).eq("status", "published").maybeSingle();
  if (!lesson) return;
  const { error } = await supabase.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id, completed }, { onConflict: "user_id,lesson_id" });
  if (!error && completed) {
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
    await notifyNewCertificates(supabase, user, (p?.first_name as string) ?? "");
  }
  revalidatePath(`/learn/${courseSlug}`, "layout");
  revalidatePath("/dashboard");
}
