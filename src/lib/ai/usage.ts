import crypto from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { AI_FEATURES, PUBLIC_DAILY_CAP, type AiFeature } from "./config";
import type { Usage } from "./provider";
export { cleanHistory } from "./history";

/**
 * Rate limits + request logging for student and public AI features (tutor, chatbot).
 * Rows are written with the service role by this server code only, so the browser can neither forge nor flood the log.
 * Only metadata is stored: never message text, never raw IPs (visitors are a salted SHA-256 of their IP).
 */
export type Actor = { type: "student"; userId: string } | { type: "admin"; userId: string } | { type: "public"; key: string };

export async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
  const salt = process.env.AI_RATE_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fola-academy";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export type QuotaResult = { ok: true; remaining: number } | { ok: false; error: string };

export async function checkQuota(feature: AiFeature, actor: Actor): Promise<QuotaResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: "The AI assistant isn't available right now." };
  const cfg = AI_FEATURES[feature];
  const since = new Date(Date.now() - cfg.windowMinutes * 60_000).toISOString();
  let q = service.from("ai_generations").select("id", { count: "exact", head: true }).eq("kind", feature).gte("created_at", since);
  q = actor.type === "public" ? q.eq("actor_key", actor.key) : q.eq("created_by", actor.userId);
  const { count, error } = await q;
  if (error) { console.error("[ai] quota check failed:", error.code); return { ok: false, error: "The AI assistant isn't available right now." }; }
  const used = count ?? 0;
  if (used >= cfg.limit) {
    return { ok: false, error: actor.type === "admin"
      ? `You've reached the limit of ${cfg.limit} requests per hour. Try again later.`
      : actor.type === "student"
      ? `You've used today's ${cfg.limit} tutor questions. They refresh over the next 24 hours.`
      : "You've asked a lot of questions in a short time. Please try again a little later, or contact us." };
  }
  if (actor.type === "public") {
    const day = new Date(Date.now() - 86_400_000).toISOString();
    const { count: all } = await service.from("ai_generations").select("id", { count: "exact", head: true }).eq("kind", "chatbot").gte("created_at", day);
    if ((all ?? 0) >= PUBLIC_DAILY_CAP) return { ok: false, error: "The assistant is resting for today. Please contact us and we'll reply by email." };
  }
  return { ok: true, remaining: cfg.limit - used - 1 };
}

export async function logRequest(o: {
  feature: AiFeature; actor: Actor; model: string; status: "succeeded" | "failed"; durationMs: number; settings?: Record<string, unknown>;
  usage?: Usage; error?: string; courseId?: string | null; lessonId?: string | null;
}) {
  const service = createServiceClient();
  if (!service) return;
  const { error } = await service.from("ai_generations").insert({
    kind: o.feature, provider: "anthropic", model: o.model, status: o.status, duration_ms: Math.round(o.durationMs),
    actor_type: o.actor.type, created_by: o.actor.type === "public" ? null : o.actor.userId, actor_key: o.actor.type === "public" ? o.actor.key : null,
    course_id: o.courseId ?? null, lesson_id: o.lessonId ?? null, input_tokens: o.usage?.inputTokens ?? null, output_tokens: o.usage?.outputTokens ?? null,
    output_count: o.status === "succeeded" ? 1 : 0, error: o.error?.slice(0, 200) ?? null, settings: o.settings ?? {},
  });
  if (error) console.error("[ai] log failed:", error.code);
}


/** Student/public AI needs both the model key and the service key (for logging + rate limits). */
export function learnerAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
