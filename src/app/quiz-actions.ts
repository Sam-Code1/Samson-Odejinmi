"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/admin/validation";
import { notifyNewCertificates } from "@/lib/certificates";

export type QuizReview = { question_id: string; is_correct: boolean; explanation: string | null; correct_option_ids: string[] | null };
export type QuizResult = {
  ok: boolean;
  error?: string;
  result?: { score: number; max: number; percent: number; passed: boolean; pass_mark: number; can_retry: boolean; review: QuizReview[] };
};

/**
 * Scoring happens inside the database (submit_quiz), which re-checks sign-in, enrolment, published status and attempt limits.
 * The browser only sends which options were ticked, never scores, never user ids.
 */
export async function submitQuiz(fd: FormData): Promise<QuizResult> {
  const user = await requireUser();
  const quizId = String(fd.get("quizId") ?? "");
  if (!isUuid(quizId)) return { ok: false, error: "That quiz isn't available." };

  const answers: Record<string, string[]> = {};
  for (const key of new Set([...fd.keys()])) {
    if (!key.startsWith("q_")) continue;
    const qid = key.slice(2);
    if (!isUuid(qid)) continue;
    answers[qid] = fd.getAll(key).map(String).filter(isUuid);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_quiz: quizId, p_answers: answers });
  if (error || !data) {
    const msg = error?.message ?? "";
    if (/retries|attempts/i.test(msg)) return { ok: false, error: "You've used all your attempts for this quiz." };
    return { ok: false, error: "We couldn't submit your answers. Please try again." };
  }
  revalidatePath("/dashboard");
  const result = data as NonNullable<QuizResult["result"]>;
  if (result.passed) {
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
    await notifyNewCertificates(supabase, user, (p?.first_name as string) ?? "");
  }
  return { ok: true, result };
}
