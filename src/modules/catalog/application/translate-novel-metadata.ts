import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, titleTranslationCache } from "@/lib/db/schema";
import { env, resolveModel } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordOpenRouterError, recordOpenRouterUsage } from "@/lib/ops-metrics";
import { estimateCost } from "@/modules/translation/application/cost-estimation";

// In-process semaphore. registerNovel fires translateNovelMetadata
// fire-and-forget for every register call; without bounding, a 50-novel
// ranking burst opens 50 simultaneous OpenRouter sockets in the Next.js
// server process.
const MAX_CONCURRENT = 3;
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight += 1;
}

function release(): void {
  inFlight -= 1;
  const next = waiters.shift();
  if (next) next();
}

/**
 * Translate a novel's title and summary from Japanese to Korean
 * using the OpenRouter API. Updates the novel record in-place.
 */
export async function translateNovelMetadata(novelId: string): Promise<void> {
  await acquire();
  try {
    await translateNovelMetadataInner(novelId);
  } finally {
    release();
  }
}

async function translateNovelMetadataInner(novelId: string): Promise<void> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return;

  const db = getDb();

  const [novel] = await db
    .select({
      titleJa: novels.titleJa,
      summaryJa: novels.summaryJa,
      titleKo: novels.titleKo,
    })
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);

  if (!novel) return;

  // Skip if already translated
  if (novel.titleKo) return;

  const prompt = buildPrompt(novel.titleJa, novel.summaryJa);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
            "You are a translator. Translate Japanese novel metadata to Korean. " +
            "Respond ONLY with a JSON object: {\"titleKo\": \"...\", \"summaryKo\": \"...\"}. " +
            "Keep character names in their original form. Translate naturally.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    await recordOpenRouterError("catalog.metadata-translation", res.status);
    return;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return;

  const inputTokens = data.usage?.prompt_tokens;
  const outputTokens = data.usage?.completion_tokens;
  if (inputTokens != null && outputTokens != null) {
    const costUsd = await estimateCost(resolveModel("title"), inputTokens, outputTokens);
    await recordOpenRouterUsage({
      operation: "catalog.metadata-translation",
      modelName: resolveModel("title"),
      inputTokens,
      outputTokens,
      costUsd,
    });
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.titleKo && typeof parsed.titleKo === "string") {
      await db
        .update(novels)
        .set({
          titleKo: parsed.titleKo,
          summaryKo: typeof parsed.summaryKo === "string" ? parsed.summaryKo : null,
          updatedAt: new Date(),
        })
        .where(eq(novels.id, novelId));

      // Also cache in title_translation_cache for ranking reuse
      const cacheRows: { titleJa: string; titleKo: string }[] = [
        { titleJa: novel.titleJa, titleKo: parsed.titleKo },
      ];
      if (novel.summaryJa && typeof parsed.summaryKo === "string") {
        cacheRows.push({ titleJa: novel.summaryJa, titleKo: parsed.summaryKo });
      }
      await db.insert(titleTranslationCache).values(cacheRows).onConflictDoNothing();
    }
  } catch {
    logger.warn("Failed to parse translated novel metadata response", {
      novelId,
    });
  }
}

function buildPrompt(titleJa: string, summaryJa: string | null): string {
  let prompt = `Title: ${titleJa}`;
  if (summaryJa) {
    // Truncate very long summaries to save tokens
    const summary = summaryJa.length > 1000 ? summaryJa.slice(0, 1000) + "..." : summaryJa;
    prompt += `\n\nSummary:\n${summary}`;
  }
  return prompt;
}
