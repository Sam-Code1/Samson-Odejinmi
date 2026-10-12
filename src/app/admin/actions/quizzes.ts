"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin, type AdminContext } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { bool, int, isUuid, optStr, str } from "@/lib/admin/validation";
import { logActivity } from "@/lib/admin/activity";

const OPTION_SLOTS = 6;

/**
 * Questions live in a reusable bank. quiz_questions links a question to any number of quizzes, with its own order.
 * questions.quiz_id is legacy ("written for this quiz") and no longer decides membership.
 */
function refresh(quizIds: (string | null | undefined)[] = []) {
  revalidatePath("/admin/quizzes");
  revalidatePath("/admin/questions");
  quizIds.filter(Boolean).forEach((id) => revalidatePath(`/admin/quizzes/${id}`));
  revalidatePath("/learn", "layout");
}

async function quizzesOf(ctx: AdminContext, questionId: string) {
  const { data } = await ctx.supabase.from("quiz_questions").select("quiz_id").eq("question_id", questionId);
  return (data ?? []).map((r) => r.quiz_id as string);
}

async function nextPosition(ctx: AdminContext, quizId: string) {
  const { data } = await ctx.supabase.from("quiz_questions").select("position").eq("quiz_id", quizId).order("position", { ascending: false }).limit(1);
  return ((data?.[0]?.position as number) ?? 0) + 1;
}

async function parseQuiz(fd: FormData, supabase: AdminContext["supabase"]) {
  const fieldErrors: Record<string, string> = {};
  const title = str(fd, "title", 140);
  if (!title) fieldErrors.title = "Quiz title is required.";
  const courseId = str(fd, "course_id", 40);
  if (!isUuid(courseId)) fieldErrors.course_id = "Choose a course.";
  const lessonId = str(fd, "lesson_id", 40);
  if (isUuid(courseId) && isUuid(lessonId)) {
    const { data } = await supabase.from("lessons").select("course_id").eq("id", lessonId).single();
    if (data?.course_id !== courseId) fieldErrors.lesson_id = "That lesson isn't part of the chosen course.";
  }
  const pass = int(fd, "pass_mark", 70, 0, 100);
  const maxAttempts = str(fd, "max_attempts", 4);
  if (maxAttempts && (!/^\d+$/.test(maxAttempts) || Number(maxAttempts) < 1)) fieldErrors.max_attempts = "Enter a whole number of 1 or more, or leave empty for unlimited.";
  if (Object.keys(fieldErrors).length) return { fieldErrors } as const;
  return {
    patch: {
      title, description: optStr(fd, "description", 600), course_id: courseId, lesson_id: isUuid(lessonId) ? lessonId : null, pass_mark: pass,
      allow_retry: bool(fd, "allow_retry"), max_attempts: maxAttempts ? Number(maxAttempts) : null, show_explanations: bool(fd, "show_explanations"),
      status: str(fd, "status", 10) === "published" ? "published" : "draft",
    },
  } as const;
}

export async function createQuiz(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const parsed = await parseQuiz(fd, ctx.supabase);
    if ("fieldErrors" in parsed) return { ok: false, fieldErrors: parsed.fieldErrors };
    const { data, error } = await ctx.supabase.from("quizzes").insert({ ...parsed.patch, status: "draft" }).select("id").single();
    if (error || !data) return dbError(error);
    await logActivity(ctx, "quiz created", "quiz", data.id, parsed.patch.title);
    refresh();
    redirect(`/admin/quizzes/${data.id}`);
  });
}

export async function saveQuiz(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "quizId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing quiz." };
    const parsed = await parseQuiz(fd, ctx.supabase);
    if ("fieldErrors" in parsed) return { ok: false, fieldErrors: parsed.fieldErrors };
    if (parsed.patch.status === "published") {
      const { data: linked } = await ctx.supabase.from("quiz_questions").select("questions!inner(id)").eq("quiz_id", id)
        .eq("questions.published", true).eq("questions.review_status", "approved").eq("questions.archived", false).limit(1);
      if (!linked?.length) return { ok: false, fieldErrors: { status: "Attach and publish at least one approved question before publishing the quiz." } };
    }
    const { data: before } = await ctx.supabase.from("quizzes").select("status").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("quizzes").update(parsed.patch).eq("id", id);
    if (error) return dbError(error);
    const published = before?.status !== "published" && parsed.patch.status === "published";
    await logActivity(ctx, published ? "quiz published" : "quiz updated", "quiz", id, parsed.patch.title);
    refresh([id]);
    return { ok: true, message: published ? "Quiz published." : "Quiz saved." };
  });
}

export async function deleteQuiz(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "quizId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing quiz." };
    const { error } = await ctx.supabase.from("quizzes").delete().eq("id", id);
    if (error) return dbError(error);
    await logActivity(ctx, "quiz deleted", "quiz", id);
    refresh();
    redirect("/admin/quizzes");
  });
}

// ───────────── quiz ↔ question links ─────────────
export async function attachQuestions(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const quizId = str(fd, "quizId", 40);
    const ids = fd.getAll("questionIds").map(String).filter(isUuid).slice(0, 100);
    if (!isUuid(quizId)) return { ok: false, error: "Missing quiz." };
    if (!ids.length) return { ok: false, error: "Tick at least one question to add." };
    let pos = await nextPosition(ctx, quizId);
    const { error } = await ctx.supabase.from("quiz_questions").upsert(ids.map((qid) => ({ quiz_id: quizId, question_id: qid, position: pos++ })), { onConflict: "quiz_id,question_id", ignoreDuplicates: true });
    if (error) return dbError(error);
    refresh([quizId]);
    return { ok: true, message: `${ids.length} ${ids.length === 1 ? "question" : "questions"} added to the quiz.` };
  });
}

export async function detachQuestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const quizId = str(fd, "quizId", 40), questionId = str(fd, "questionId", 40);
    if (!isUuid(quizId) || !isUuid(questionId)) return { ok: false, error: "Missing question." };
    const { error } = await ctx.supabase.from("quiz_questions").delete().eq("quiz_id", quizId).eq("question_id", questionId);
    if (error) return dbError(error);
    refresh([quizId]);
    return { ok: true, message: "Removed from this quiz. It's still in the question bank." };
  });
}

export async function moveQuizQuestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const quizId = str(fd, "quizId", 40), questionId = str(fd, "questionId", 40), dir = str(fd, "dir", 4);
    if (!isUuid(quizId) || !isUuid(questionId) || !["up", "down"].includes(dir)) return { ok: false, error: "That move isn't valid." };
    const { data } = await ctx.supabase.from("quiz_questions").select("question_id").eq("quiz_id", quizId).order("position").order("created_at");
    const ids = (data ?? []).map((r) => r.question_id as string);
    const i = ids.indexOf(questionId), j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const results = await Promise.all(ids.map((qid, k) => ctx.supabase.from("quiz_questions").update({ position: k + 1 }).eq("quiz_id", quizId).eq("question_id", qid)));
    const failed = results.find((r) => r.error);
    if (failed) return dbError(failed.error);
    refresh([quizId]);
    return { ok: true, message: "Question moved." };
  });
}

// ───────────── questions ─────────────
export async function saveQuestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const { supabase } = ctx;
    const quizId = str(fd, "quizId", 40);
    const questionId = str(fd, "questionId", 40);
    const text = str(fd, "question_text", 1000);
    const type = str(fd, "question_type", 20);
    const fieldErrors: Record<string, string> = {};
    if (!text) fieldErrors.question_text = "Question text is required.";
    if (!["multiple_choice", "true_false", "multiple_select"].includes(type)) fieldErrors.question_type = "Choose a question type.";

    // Where the question belongs in the bank (for filtering and reuse).
    let courseId = str(fd, "course_id", 40);
    const lessonId = str(fd, "lesson_id", 40);
    let moduleId: string | null = null;
    if (isUuid(quizId) && !isUuid(courseId)) {
      const { data: q } = await supabase.from("quizzes").select("course_id").eq("id", quizId).maybeSingle();
      courseId = (q?.course_id as string) ?? "";
    }
    if (isUuid(lessonId)) {
      const { data: l } = await supabase.from("lessons").select("course_id, module_id").eq("id", lessonId).maybeSingle();
      if (!l || (isUuid(courseId) && l.course_id !== courseId)) fieldErrors.lesson_id = "That lesson isn't part of the chosen course.";
      else { courseId = l.course_id as string; moduleId = l.module_id as string; }
    }

    let options: { option_text: string; is_correct: boolean }[] = [];
    if (type === "true_false") {
      const t = str(fd, "tf_correct", 5) === "true";
      options = [{ option_text: "True", is_correct: t }, { option_text: "False", is_correct: !t }];
    } else {
      for (let i = 0; i < OPTION_SLOTS; i++) {
        const t = str(fd, `opt_text_${i}`, 300);
        if (t) options.push({ option_text: t, is_correct: bool(fd, `opt_correct_${i}`) });
      }
      const correct = options.filter((o) => o.is_correct).length;
      const texts = options.map((o) => o.option_text.toLowerCase());
      if (options.length < 2) fieldErrors.options = "Add at least two answer options.";
      else if (new Set(texts).size !== texts.length) fieldErrors.options = "Two options have the same text.";
      else if (type === "multiple_choice" && correct !== 1) fieldErrors.options = "Multiple choice needs exactly one correct answer.";
      else if (type === "multiple_select" && correct < 1) fieldErrors.options = "Tick at least one correct answer.";
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

    const difficulty = str(fd, "difficulty", 10);
    const row = {
      question_text: text, question_type: type, explanation: optStr(fd, "explanation", 1000),
      points: int(fd, "points", 1, 1, 100), difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : null,
      course_id: isUuid(courseId) ? courseId : null, lesson_id: isUuid(lessonId) ? lessonId : null, module_id: moduleId,
    };

    let id = questionId;
    if (isUuid(questionId)) {
      const { error } = await supabase.from("questions").update(row).eq("id", questionId);
      if (error) return dbError(error);
      await supabase.from("question_options").delete().eq("question_id", questionId);
    } else {
      const { data, error } = await supabase.from("questions").insert({ ...row, quiz_id: isUuid(quizId) ? quizId : null, position: 0, source: "manual", review_status: "draft", published: false }).select("id").single();
      if (error || !data) return dbError(error);
      id = data.id;
      if (isUuid(quizId)) {
        const { error: le } = await supabase.from("quiz_questions").insert({ quiz_id: quizId, question_id: id, position: await nextPosition(ctx, quizId) });
        if (le) return dbError(le);
      }
    }
    const { error: oe } = await supabase.from("question_options").insert(options.map((o, i) => ({ question_id: id, option_text: o.option_text, is_correct: o.is_correct, position: i })));
    if (oe) return dbError(oe);
    refresh(await quizzesOf(ctx, id));
    revalidatePath(`/admin/questions/${id}`);
    if (!isUuid(questionId)) redirect(`/admin/questions/${id}`);
    return { ok: true, message: "Question saved." };
  });
}

/** The only way a question becomes visible to students: approve, then publish. AI output starts as 'ai_generated'. */
export async function reviewQuestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "questionId", 40);
    const op = str(fd, "op", 10);
    if (!isUuid(id)) return { ok: false, error: "Missing question." };
    const patches: Record<string, { review_status?: string; published?: boolean; archived?: boolean }> = {
      approve: { review_status: "approved" }, reject: { review_status: "rejected", published: false },
      draft: { review_status: "draft", published: false }, publish: { published: true }, unpublish: { published: false },
      archive: { archived: true, published: false }, restore: { archived: false },
    };
    const patch = patches[op];
    if (!patch) return { ok: false, error: "That action isn't valid." };
    if (op === "publish") {
      const { data: q } = await ctx.supabase.from("questions").select("review_status, archived").eq("id", id).single();
      if (q?.review_status !== "approved") return { ok: false, error: "Approve the question before publishing it." };
      if (q?.archived) return { ok: false, error: "Restore the question before publishing it." };
    }
    const { data, error } = await ctx.supabase.from("questions").update(patch).eq("id", id).select("question_text").single();
    if (error || !data) return dbError(error);
    if (["approve", "publish", "archive"].includes(op)) await logActivity(ctx, `question ${op === "approve" ? "approved" : op === "publish" ? "published" : "archived"}`, "question", id, (data.question_text as string).slice(0, 120));
    refresh(await quizzesOf(ctx, id));
    const msg: Record<string, string> = { approve: "Question approved.", reject: "Question rejected.", draft: "Question moved back to draft.", publish: "Question published.", unpublish: "Question unpublished.", archive: "Question archived.", restore: "Question restored." };
    return { ok: true, message: msg[op] };
  });
}

export async function deleteQuestion(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin(async (ctx) => {
    const id = str(fd, "questionId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing question." };
    const quizzes = await quizzesOf(ctx, id);
    const { error } = await ctx.supabase.from("questions").delete().eq("id", id);
    if (error) return dbError(error);
    refresh(quizzes);
    if (str(fd, "redirectTo", 200).startsWith("/admin/")) redirect(str(fd, "redirectTo", 200));
    return { ok: true, message: "Question deleted." };
  });
}
