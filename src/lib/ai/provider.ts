import type * as z from "zod/v4";

/**
 * Provider abstraction for AI features. Everything AI goes through `getAiProvider()`, server-side only.
 * To switch providers later, add another implementation of `AiProvider` and select it with AI_PROVIDER.
 * API keys are read from server environment variables only (never NEXT_PUBLIC_*), and never sent to the browser.
 */
export type GenerateObjectOptions<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Hard ceiling on output tokens for this request (cost control). */
  maxTokens: number;
};

export type GenerateObjectResult<T> = { data: T; model: string; usage: { inputTokens: number; outputTokens: number } };

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>>;
}

export type AiErrorKind = "not_configured" | "refused" | "rate_limited" | "invalid_output" | "provider" | "too_large";

/** Errors carry a kind and a message that is safe to show an admin. Raw provider errors are logged server-side only. */
export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
    this.name = "AiError";
  }
}

export type AiStatus = { configured: boolean; provider: string; model: string | null; envVar: string };

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/** Reports configuration without exposing any secret value. */
export function aiStatus(): AiStatus {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (provider === "anthropic") {
    return { configured: Boolean(process.env.ANTHROPIC_API_KEY), provider: "Anthropic (Claude)", model: process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL, envVar: "ANTHROPIC_API_KEY" };
  }
  return { configured: false, provider, model: null, envVar: "AI_PROVIDER" };
}

export async function getAiProvider(): Promise<AiProvider> {
  const provider = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new AiError("not_configured", "AI isn't configured. Add ANTHROPIC_API_KEY to the server environment (.env.local), then restart the server.");
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider(key, process.env.AI_MODEL || DEFAULT_ANTHROPIC_MODEL);
  }
  throw new AiError("not_configured", `AI provider “${provider}” isn't supported. Set AI_PROVIDER=anthropic.`);
}
