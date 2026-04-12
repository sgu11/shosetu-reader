import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../domain/provider";

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
    this.modelName = modelName ?? "google/gemini-2.5-flash-lite";
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
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: this.buildSystemPrompt() },
    ];

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
    messages.push({
      role: "user",
      content: `Translate the following Japanese text to Korean${chunkNote}:\n\n${request.sourceText}`,
    });

    // Adaptive max_tokens: ~1.5x expansion ratio, ~2 chars/token for Korean
    const sourceChars = request.sourceText.length;
    const adaptiveMaxTokens = Math.min(
      Math.max(Math.ceil((sourceChars * 1.5) / 2) + 512, 2048),
      32768,
    );

    let currentMaxTokens = adaptiveMaxTokens;
    let truncationRetried = false;

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

      // Retry once with doubled max_tokens if output was truncated
      if (finishReason === "length" && !truncationRetried) {
        truncationRetried = true;
        currentMaxTokens = Math.min(currentMaxTokens * 2, 65536);
        continue;
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
