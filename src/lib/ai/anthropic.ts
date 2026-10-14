import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiError, type AiProvider, type GenerateObjectOptions, type GenerateObjectResult, type GenerateTextOptions, type GenerateTextResult } from "./provider";

/**
 * Claude via the official Anthropic SDK. Server-only: the key comes from ANTHROPIC_API_KEY and never leaves the server.
 *
 * - Structured outputs (`output_config.format`) constrain JSON responses to a Zod schema; callers still re-validate
 *   the content, because "valid JSON" isn't the same as "a good question".
 * - Server-side refusal fallbacks are enabled (`fallbacks: "default"`), so a safety-classifier decline is retried on a
 *   fallback model inside the same request. A final refusal is reported clearly.
 * - The SDK retries 429/5xx/connection errors (maxRetries: 2) with backoff; we add no loops of our own.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string, readonly model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  private fail(e: unknown): never {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("timeout", "The AI took too long to respond. Please try again.");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI provider is busy right now. Wait a minute and try again.");
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AiError("not_configured", "The AI provider rejected the API key. Check ANTHROPIC_API_KEY on the server.");
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error("[ai] bad request:", e.status, e.message);
      throw new AiError("provider", "The AI couldn't process this request. Try a shorter question or less material.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[ai] provider error:", e.status, e.message);
      throw new AiError("provider", "The AI provider had a problem. Please try again.");
    }
    console.error("[ai] unexpected:", e instanceof Error ? e.message : e);
    throw new AiError("invalid_output", "The AI response couldn't be read.");
  }

  async generateObject<T>({ system, prompt, schema, maxTokens, model, effort = "medium" }: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: model ?? this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort, format: betaZodOutputFormat(schema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      this.fail(e);
    }
    if (response.stop_reason === "refusal") throw new AiError("refused", "The AI declined to generate content from this material.");
    if (response.stop_reason === "max_tokens") throw new AiError("invalid_output", "The AI response was cut off. Try fewer questions.");
    if (response.parsed_output == null) throw new AiError("invalid_output", "The AI response didn't match the expected structure.");
    return { data: response.parsed_output as T, model: response.model, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
  }

  async generateText({ system, messages, maxTokens, model, effort = "low" }: GenerateTextOptions): Promise<GenerateTextResult> {
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: model ?? this.model,
        max_tokens: maxTokens,
        system,
        messages,
        output_config: { effort },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      }, { timeout: 60_000 });
    } catch (e) {
      this.fail(e);
    }
    if (response.stop_reason === "refusal") throw new AiError("refused", "I can't help with that one. Try asking about the lesson in a different way.");
    const text = response.content.filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text").map((b) => b.text).join("").trim();
    if (!text) throw new AiError("invalid_output", "The AI returned an empty answer. Please try again.");
    return { text, model: response.model, usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens } };
  }
}
