import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { titleTranslationCache } from "@/lib/db/schema";
import { env, resolveModel } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordOpenRouterError, recordOpenRouterUsage } from "@/lib/ops-metrics";
import { estimateCost } from "@/modules/translation/application/cost-estimation";

const BATCH_SIZE = 50;
const NUMBER_ONLY = /^\d+$/;

/**
 * Translate Japanese texts to Korean with DB caching.
 * Skips number-only strings. Returns a map of ja → ko.
 */
export async function translateTexts(
  texts: string[],
): Promise<Map<string, string>> {
  const db = getDb();
  const result = new Map<string, string>();

  // Filter out empty and number-only strings
  const translatable = [...new Set(texts.filter((t) => t.trim() && !NUMBER_ONLY.test(t.trim())))];
  if (translatable.length === 0) return result;

  // Look up cache
  const cached = await db
    .select()
    .from(titleTranslationCache)
    .where(inArray(titleTranslationCache.titleJa, translatable));

  for (const row of cached) {
    result.set(row.titleJa, row.titleKo);
  }

  // Find uncached
  const uncached = translatable.filter((t) => !result.has(t));
  if (uncached.length === 0 || !env.OPENROUTER_API_KEY) return result;

  // Translate in batches
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const translated = await translateBatch(batch);

    const rows: { titleJa: string; titleKo: string }[] = [];
    for (let j = 0; j < batch.length; j++) {
      const ko = translated[j];
      if (ko && ko !== batch[j]) {
        result.set(batch[j], ko);
        rows.push({ titleJa: batch[j], titleKo: ko });
      }
    }

    if (rows.length > 0) {
      await db.insert(titleTranslationCache).values(rows).onConflictDoNothing();
    }
  }

  return result;
}

async function translateBatch(texts: string[]): Promise<string[]> {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const MAX_RETRIES = 3;
  const RETRYABLE = new Set([429, 502, 503, 504]);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shosetu-reader.local",
        "X-Title": "Shosetu Reader",
      },
      body: JSON.stringify({
        model: resolveModel("title"),
        messages: [
          {
            role: "system",
            content:
              "You are a Japanese-to-Korean translator. Translate the given Japanese texts naturally into Korean. Keep character names in their original form. Output ONLY the numbered list of translated texts, one per line, matching the input numbering exactly. No explanations.",
          },
          {
            role: "user",
            content: `Translate these Japanese texts to Korean:\n\n${numbered}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      await recordOpenRouterError("title-translation.batch", res.status);
      if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      logger.warn("OpenRouter batch title translation failed", {
        status: res.status,
      });
      return texts;
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const inputTokens = data.usage?.prompt_tokens;
    const outputTokens = data.usage?.completion_tokens;

    if (inputTokens != null && outputTokens != null) {
      const costUsd = await estimateCost(resolveModel("title"), inputTokens, outputTokens);
      await recordOpenRouterUsage({
        operation: "title-translation.batch",
        modelName: resolveModel("title"),
        inputTokens,
        outputTokens,
        costUsd,
      });
    }

    const translated: Record<number, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^(\d+)\.\s*(.+)/);
      if (match) {
        translated[parseInt(match[1], 10) - 1] = match[2].trim();
      }
    }

    return texts.map((original, i) => translated[i] ?? original);
  }

  return texts;
}
