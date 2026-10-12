"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, isUuid, lines, optStr, slugify, str } from "@/lib/admin/validation";
import { isFile, uploadImage } from "@/lib/admin/storage";
import { logActivity } from "@/lib/admin/activity";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const CURRENCIES = ["NGN", "USD", "GBP"] as const;

function revalidatePublic(slug?: string) {
  revalidatePath("/academy");
  revalidatePath("/academy/courses");
  if (slug) revalidatePath(`/academy/courses/${slug}`);
}

export async function createCourse(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const { supabase } = ctx;
    const title = str(fd, "title", 120);
    if (!title) return { ok: false, fieldErrors: { title: "Course title is required." } };
    const slug = slugify(str(fd, "slug", 80) || title);
    if (!slug) return { ok: false, fieldErrors: { slug: "Slug can only contain letters, numbers and hyphens." } };
    const { data, error } = await supabase.from("courses").insert({ title, slug, status: "draft" }).select("id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another course already uses that slug." } };
    if (error || !data) return dbError(error);
    await logActivity(ctx, "course created", "course", data.id, title);
    revalidatePath("/admin/courses");
    redirect(`/admin/courses/${data.id}`);
  });
}

export async function saveCourse(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing course." };
    const title = str(fd, "title", 120);
    const slug = slugify(str(fd, "slug", 80));
    const fieldErrors: Record<string, string> = {};
    if (!title) fieldErrors.title = "Course title is required.";
    if (!slug) fieldErrors.slug = "Slug is required (letters, numbers and hyphens).";
    const level = optStr(fd, "level", 20);
    if (level && !LEVELS.includes(level)) fieldErrors.level = "Choose a difficulty from the list.";
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const patch: Record<string, unknown> = {
      title, slug, subtitle: optStr(fd, "subtitle", 240), description: optStr(fd, "description", 8000), level,
      instructor: optStr(fd, "instructor", 120), category: optStr(fd, "category", 60), estimated_duration: optStr(fd, "estimated_duration", 60),
      objectives: lines(fd, "objectives"), learning_outcomes: lines(fd, "learning_outcomes"), requirements: lines(fd, "requirements"), target_audience: lines(fd, "target_audience"),
    };
    for (const [field, kind] of [["image", "image"], ["thumbnail", "thumbnail"]] as const) {
      const f = fd.get(field);
      if (isFile(f)) {
        const up = await uploadImage(ctx, f, kind, { course_id: id });
        if (!up.ok) return { ok: false, fieldErrors: { [field]: up.error } };
        patch[field === "image" ? "image_url" : "thumbnail_url"] = up.url;
      }
    }
    const { error } = await ctx.supabase.from("courses").update(patch).eq("id", id);
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another course already uses that slug." } };
    if (error) return dbError(error);
    await logActivity(ctx, "course updated", "course", id, title);
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    revalidatePublic(slug);
    return { ok: true, message: "Course saved." };
  });
}

export async function saveSeo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing course." };
    const seo_title = optStr(fd, "seo_title", 70);
    const seo_description = optStr(fd, "seo_description", 170);
    const { data, error } = await supabase.from("courses").update({ seo_title, seo_description }).eq("id", id).select("slug").single();
    if (error) return dbError(error);
    revalidatePublic(data?.slug);
    return { ok: true, message: "SEO details saved." };
  });
}

export async function savePricing(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "id", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing course." };
    const fieldErrors: Record<string, string> = {};
    const rows: { course_id: string; currency: string; amount_minor: number; active: boolean }[] = [];
    const remove: string[] = [];
    for (const c of CURRENCIES) {
      const raw = str(fd, `price_${c}`, 20).replace(/,/g, "");
      if (raw === "") { remove.push(c); continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) { fieldErrors[`price_${c}`] = "Enter a valid amount, for example 25000."; continue; }
      rows.push({ course_id: id, currency: c, amount_minor: Math.round(n * 100), active: bool(fd, `active_${c}`) });
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
    if (rows.length) {
      const { error } = await supabase.from("course_pricing").upsert(rows, { onConflict: "course_id,currency" });
      if (error) return dbError(error);
    }
    if (remove.length) await supabase.from("course_pricing").delete().eq("course_id", id).in("currency", remove);
    revalidatePath(`/admin/courses/${id}`);
    revalidatePublic();
    return { ok: true, message: "Pricing saved." };
  });
}

export async function setCourseStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const { supabase } = ctx;
    const id = str(fd, "courseId", 40);
    const to = str(fd, "to", 20);
    if (!isUuid(id) || !["published", "draft", "archived"].includes(to)) return { ok: false, error: "That change isn't valid." };
    if (str(fd, "confirm", 5) !== "yes") return { ok: false, error: "Please confirm this change." };

    const { data: course } = await supabase.from("courses").select("title, slug").eq("id", id).single();
    if (!course) return { ok: false, error: "Course not found." };
    if (to === "published") {
      if (!course.title || !course.slug) return { ok: false, error: "Add a title and slug before publishing." };
      const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", id).eq("status", "published");
      if (!count) return { ok: false, error: "Publish at least one lesson before publishing the course." };
    }
    const { error } = await supabase.from("courses").update({ status: to }).eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, to === "published" ? "course published" : to === "archived" ? "course archived" : "course unpublished", "course", id, course.title as string);
    revalidatePath("/admin/courses");
    revalidatePath(`/admin/courses/${id}`);
    revalidatePublic(course.slug);
    return { ok: true, message: to === "published" ? "Course published." : to === "archived" ? "Course archived." : "Course moved to draft." };
  });
}

export async function setCertificates(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async ({ supabase }) => {
    const id = str(fd, "courseId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing course." };
    const { error } = await supabase.from("courses").update({ certificate_enabled: str(fd, "enabled", 5) === "yes" }).eq("id", id);
    if (error) return dbError(error);
    revalidatePath(`/admin/courses/${id}`);
    return { ok: true, message: "Certificate setting saved." };
  });
}
