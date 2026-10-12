import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiError, type AiProvider, type GenerateObjectOptions, type GenerateObjectResult } from "./provider";

/**
 * Claude via the official Anthropic SDK. Server-only: the key comes from ANTHROPIC_API_KEY and never leaves the server.
 *
 * - Structured outputs (`output_config.format`) constrain the response to the Zod schema; we still re-validate the
 *   content ourselves afterwards, because "valid JSON" isn't the same as "a good question".
 * - Server-side refusal fallbacks are enabled (`fallbacks: "default"`), so a safety-classifier decline is retried on a
 *   fallback model inside the same request instead of failing outright. A final refusal is reported clearly.
 * - Retries on 429/5xx are handled by the SDK (maxRetries); we add no background loops.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string, readonly model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async generateObject<T>({ system, prompt, schema, maxTokens }: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI provider is busy right now (rate limited). Wait a minute and try again.");
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
        throw new AiError("not_configured", "The AI provider rejected the API key. Check ANTHROPIC_API_KEY on the server.");
      }
      if (e instanceof Anthropic.BadRequestError) {
        console.error("[ai] bad request:", e.status, e.message);
        throw new AiError("provider", "The AI provider couldn't process this request. Try fewer questions or less source material.");
      }
      if (e instanceof Anthropic.APIError) {
        console.error("[ai] provider error:", e.status, e.message);
        throw new AiError("provider", "The AI provider had a problem. Please try again.");
      }
      // zod / JSON parse failures from the SDK's parser end up here.
      console.error("[ai] unexpected:", e instanceof Error ? e.message : e);
      throw new AiError("invalid_output", "The AI response couldn't be read.");
    }

    if (response.stop_reason === "refusal") throw new AiError("refused", "The AI declined to generate content from this material.");
    if (response.stop_reason === "max_tokens") throw new AiError("invalid_output", "The AI response was cut off. Try fewer questions.");
    if (response.parsed_output == null) throw new AiError("invalid_output", "The AI response didn't match the expected structure.");

    return {
      data: response.parsed_output as T,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
