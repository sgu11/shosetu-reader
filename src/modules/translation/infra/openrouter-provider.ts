import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "../domain/provider";

const SYSTEM_PROMPT = `You are a professional Japanese-to-Korean translator specializing in web novel (ウェブ小説) translation.

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

  constructor(apiKey: string, modelName?: string) {
    this.apiKey = apiKey;
    this.modelName = modelName ?? "anthropic/claude-sonnet-4-20250514";
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Translate the following Japanese text to Korean:\n\n${request.sourceText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(
        `OpenRouter API error ${res.status}: ${errorBody.slice(0, 200)}`,
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No translation content in OpenRouter response");
    }

    return {
      translatedText: content.trim(),
      provider: this.provider,
      modelName: this.modelName,
    };
  }
}
