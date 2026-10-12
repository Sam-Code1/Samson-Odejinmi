"use server";

import { revalidatePath } from "next/cache";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, isUuid, safeSearch, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";

const STATUSES = ["active", "completed", "cancelled", "refunded", "pending"];

function refresh() {
  revalidatePath("/admin/enrolments");
  revalidatePath("/admin/students");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/learn", "layout");
}

/** Manual enrolment (until payments are connected). Requires explicit confirmation. */
export async function enrolStudent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("enrolments", async (ctx) => {
    const { supabase } = ctx;
    const email = safeSearch(str(fd, "email", 200)).toLowerCase();
    const courseId = str(fd, "course_id", 40);
    const status = str(fd, "status", 12) || "active";
    const fieldErrors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter the student's email address.";
    if (!isUuid(courseId)) fieldErrors.course_id = "Choose a course.";
    if (!STATUSES.includes(status)) fieldErrors.status = "Choose a status.";
    if (!bool(fd, "confirm")) fieldErrors.confirm = "Tick the box to confirm this enrolment.";
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!profile) return { ok: false, fieldErrors: { email: "No student has registered with that email yet. Ask them to create an account first." } };
    const { error } = await supabase.from("enrolments").upsert({ user_id: profile.id, course_id: courseId, status, source: "manual" }, { onConflict: "user_id,course_id" });
    if (error) return dbError(error);
    await logActivity(ctx, "student manually enrolled", "enrolment", profile.id as string, email, { course_id: courseId, status });
    refresh();
    return { ok: true, message: "Student enrolled." };
  });
}

export async function setEnrolmentStatus(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("enrolments", async (ctx) => {
    const { supabase } = ctx;
    const id = str(fd, "enrolmentId", 40);
    const to = str(fd, "to", 12);
    if (!isUuid(id) || !STATUSES.includes(to)) return { ok: false, error: "That change isn't valid." };
    const { error } = await supabase.from("enrolments").update({ status: to }).eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "enrolment status changed", "enrolment", id, null, { status: to });
    refresh();
    return { ok: true, message: `Enrolment marked ${to}.` };
  });
}

export async function setCertificateRevoked(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("certificates", async (ctx) => {
    const { supabase } = ctx;
    const id = str(fd, "certificateId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing certificate." };
    const revoked = str(fd, "revoked", 5) === "yes";
    const { error } = await supabase.from("certificates").update({ revoked }).eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, revoked ? "certificate revoked" : "certificate restored", "certificate", id);
    revalidatePath("/admin/certificates");
    return { ok: true, message: revoked ? "Certificate revoked." : "Certificate restored." };
  });
}

/** Manually issue a certificate (e.g. an offline completion). The database requires an enrolment and never duplicates. */
export async function issueCertificate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("certificates", async (ctx) => {
    const email = safeSearch(str(fd, "email", 200)).toLowerCase();
    const courseId = str(fd, "course_id", 40);
    const fieldErrors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter the student's email address.";
    if (!isUuid(courseId)) fieldErrors.course_id = "Choose a course.";
    if (!bool(fd, "confirm")) fieldErrors.confirm = "Tick the box to confirm.";
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
    const { data: profile } = await ctx.supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!profile) return { ok: false, fieldErrors: { email: "No student with that email." } };
    const { data: num, error } = await ctx.supabase.rpc("admin_issue_certificate", { p_user: profile.id, p_course: courseId });
    if (error) {
      if (/not enrolled/i.test(error.message)) return { ok: false, error: "That student isn't enrolled in this course." };
      if (/already issued/i.test(error.message)) return { ok: false, error: "That student already has a certificate for this course." };
      return dbError(error);
    }
    await logActivity(ctx, "certificate generated", "certificate", null, String(num), { email, course_id: courseId });
    revalidatePath("/admin/certificates");
    return { ok: true, message: `Certificate ${num} issued.` };
  });
}
