/**
 * Central AI configuration. Every AI feature reads its model, effort and limits from here; no model names are
 * hard-coded elsewhere. Model per feature can be overridden with env vars (AI_MODEL_<FEATURE>), falling back to AI_MODEL.
 */
export type AiFeature = "quiz" | "regenerate" | "content" | "lesson_assistant" | "tutor" | "chatbot";
export type Effort = "low" | "medium" | "high";

type FeatureConfig = {
  /** Output-token ceiling per request (cost control). */
  maxTokens: number;
  /** Lower effort = faster, cheaper, shorter answers. Conversational features use low. */
  effort: Effort;
  /** Requests allowed per window, per actor (admin/student id, or hashed visitor IP for the public chatbot). */
  limit: number;
  windowMinutes: number;
  /** Longest single user message accepted. */
  maxInputChars: number;
};

export const DEFAULT_MODEL = "claude-opus-5-5";

export const AI_FEATURES: Record<AiFeature, FeatureConfig> = {
  quiz:             { maxTokens: 16_000, effort: "medium", limit: 30, windowMinutes: 60,   maxInputChars: 60_000 },
  regenerate:       { maxTokens: 4_000,  effort: "medium", limit: 30, windowMinutes: 60,   maxInputChars: 60_000 },
  content:          { maxTokens: 4_000,  effort: "medium", limit: 30, windowMinutes: 60,   maxInputChars: 20_000 },
  lesson_assistant: { maxTokens: 4_000,  effort: "medium", limit: 40, windowMinutes: 60,   maxInputChars: 2_000 },
  tutor:            { maxTokens: 1_500,  effort: "low",    limit: 40, windowMinutes: 1440, maxInputChars: 1_000 },
  chatbot:          { maxTokens: 900,    effort: "low",    limit: 15, windowMinutes: 60,   maxInputChars: 600 },
};

/** Hard daily ceiling across ALL public chatbot visitors, so a bot farm can't drain the budget. */
export const PUBLIC_DAILY_CAP = Number(process.env.AI_PUBLIC_DAILY_CAP ?? 500);
/** Conversation turns sent back to the model for tutor/chatbot (older turns are dropped). */
export const MAX_HISTORY_TURNS = 8;

export function modelFor(feature: AiFeature): string {
  return process.env[`AI_MODEL_${feature.toUpperCase()}`] || process.env.AI_MODEL || DEFAULT_MODEL;
}
