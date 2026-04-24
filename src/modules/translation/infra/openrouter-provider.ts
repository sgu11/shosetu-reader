import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../domain/provider";
import { logger } from "@/lib/logger";
import { recordOpenRouterError } from "@/lib/ops-metrics";

const BASE_SYSTEM_PROMPT = `You are a professional Japanese-to-Korean translator specializing in web novel (ウェブ小説) translation.

Rules:
- Translate naturally into Korean, preserving the author's tone and style.
- Keep character names in their original form (katakana/kanji).
- Preserve paragraph breaks exactly as they appear.
- Do not add explanations, notes, or commentary.
- Output only the translated text.`;

export class OpenRouterProvider implements TranslationProvider {
  readonly provider = "openrouter";
  readonly modelName: string;
  private apiKey: string;
  private globalPrompt: string;
  /** Combined glossary prompt: structured entries table + style guide text */
  private glossary: string;

  constructor(
    apiKey: string,
    modelName?: string,
    globalPrompt?: string,
    glossary?: string,
  ) {
    this.apiKey = apiKey;
    this.modelName = modelName ?? "deepseek/deepseek-v4-flash";
    this.globalPrompt = globalPrompt ?? "";
    this.glossary = glossary ?? "";
  }

  buildSystemPrompt(): string {
    const parts = [BASE_SYSTEM_PROMPT];

    if (this.globalPrompt.trim()) {
      parts.push(`\nAdditional translation guidelines:\n${this.globalPrompt.trim()}`);
    }

    if (this.glossary.trim()) {
      parts.push(`\n${this.glossary.trim()}`);
    }

    return parts.join("\n");
  }

  async translate(request: TranslationRequest, contextSummary?: string): Promise<TranslationResult> {
    const MAX_RETRIES = 3;
    const RETRYABLE = new Set([429, 502, 503, 504]);

    // Build messages: system (stable/cacheable) → context (per-session) → source (per-episode)
    // The system message is identical across requests for the same novel/session,
    // enabling automatic prefix caching on Gemini and explicit cache_control on Anthropic.
    const systemMessage: Record<string, unknown> = {
      role: "system",
      content: this.buildSystemPrompt(),
    };
    // Anthropic models on OpenRouter support cache_control breakpoints
    if (this.modelName.startsWith("anthropic/")) {
      systemMessage.cache_control = { type: "ephemeral" };
    }
    const messages: Array<Record<string, unknown>> = [systemMessage];

    if (contextSummary?.trim()) {
      messages.push({
        role: "user",
        content: `Story context from previous episodes:\n\n${contextSummary.trim()}`,
      });
      messages.push({
        role: "assistant",
        content: "Understood. I will use this context to maintain consistency in the translation.",
      });
    }

    // Chunk continuity context: inject previous chunk's translated tail
    if (request.previousChunkTranslation?.trim()) {
      messages.push({
        role: "user",
        content: `This is a continuation (chunk ${request.chunkLabel ?? ""}). The previous chunk's translation ended with:\n\n${request.previousChunkTranslation.trim()}`,
      });
      messages.push({
        role: "assistant",
        content: "Understood. I will continue the translation seamlessly. I will NOT repeat the context text in my output.",
      });
    }

    const chunkNote = request.chunkLabel
      ? ` (chunk ${request.chunkLabel})`
      : "";
    const authorNotePrefix = request.isAuthorNote
      ? "This is the author's note (前書き/後書き), not story content. Translate it as an author's note.\n\n"
      : "";
    messages.push({
      role: "user",
      content: `${authorNotePrefix}Translate the following Japanese text to Korean${chunkNote}:\n\n${request.sourceText}`,
    });

    // Adaptive max_tokens: ~1.5x expansion, ~1.2 chars/token for Korean.
    // Older formula used 2 chars/token which understates on models like
    // DeepSeek whose Korean tokenizer is denser — 6K-char chunks regularly
    // blew past the returned max_tokens and triggered finish_reason=length.
    const sourceChars = request.sourceText.length;
    const adaptiveMaxTokens = Math.min(
      Math.max(Math.ceil((sourceChars * 1.5) / 1.2) + 1024, 4096),
      65536,
    );

    let currentMaxTokens = adaptiveMaxTokens;
    const MAX_TRUNCATION_RETRIES = 2;
    let truncationRetries = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://shosetu-reader.local",
          "X-Title": "Shosetu Reader",
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: 0.3,
          max_tokens: currentMaxTokens,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        await recordOpenRouterError("translation.episode", res.status);
        if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(
          `OpenRouter API error ${res.status}: ${errorBody.slice(0, 200)}`,
        );
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      const finishReason = data.choices?.[0]?.finish_reason as string | undefined;

      if (!content) {
        throw new Error("No translation content in OpenRouter response");
      }

      // Retry with progressively higher max_tokens when output is truncated.
      // Some models cap completions below our first estimate; doubling up to
      // twice (4x original) covers the common case without runaway cost.
      if (finishReason === "length" && truncationRetries < MAX_TRUNCATION_RETRIES) {
        truncationRetries += 1;
        currentMaxTokens = Math.min(currentMaxTokens * 2, 131072);
        continue;
      }

      // Log prompt cache metrics when available (Gemini: cached_tokens, Anthropic: cache_read_input_tokens)
      const cachedTokens = data.usage?.cached_tokens
        ?? data.usage?.cache_read_input_tokens
        ?? data.usage?.prompt_tokens_details?.cached_tokens;
      if (cachedTokens != null && cachedTokens > 0) {
        logger.info("Prompt cache hit", {
          model: this.modelName,
          cachedTokens,
          totalInputTokens: data.usage?.prompt_tokens,
        });
      }

      return {
        translatedText: content.trim(),
        provider: this.provider,
        modelName: this.modelName,
        inputTokens: data.usage?.prompt_tokens ?? undefined,
        outputTokens: data.usage?.completion_tokens ?? undefined,
        finishReason,
      };
    }

    throw new Error("Max retries exceeded");
  }
}
