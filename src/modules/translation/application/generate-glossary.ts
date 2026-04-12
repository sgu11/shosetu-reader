import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, novelGlossaries } from "@/lib/db/schema";
import { env } from "@/lib/env";

const GLOSSARY_SYSTEM_PROMPT = `You are a professional translation quality reviewer specializing in Japanese-to-Korean web novel translation.

Given the first episodes of a Japanese web novel alongside their Korean translations, produce a comprehensive glossary and translation guideline document.

Your output must include:

1. **Character Names** — Japanese name → Korean rendering, with notes on honorifics and naming conventions used.
2. **Place Names & Proper Nouns** — Japanese → Korean, noting any localization choices.
3. **Recurring Terms & Jargon** — Game/magic/military terms, unique world-building vocabulary, etc.
4. **Style & Tone Guidelines** — Speech level (격식체/비격식체), narrator voice, character-specific speech patterns.
5. **Translation Notes** — Any consistency issues found, recommended fixes, or patterns to maintain.

Format the output in clean Korean, using markdown. Keep entries concise but complete enough for a translator to use as reference.`;

interface GlossaryResult {
  glossary: string;
  modelName: string;
  episodeCount: number;
}

/**
 * Generate a glossary from the first N translated episodes of a novel.
 * Sends paired JP source + KR translation to LLM for analysis.
 */
export async function generateGlossary(
  novelId: string,
  modelOverride?: string,
  maxEpisodes = 10,
): Promise<GlossaryResult> {
  const db = getDb();

  // Fetch first N episodes that have available Korean translations
  const rows = await db
    .select({
      episodeNumber: episodes.episodeNumber,
      titleJa: episodes.titleJa,
      sourceText: episodes.normalizedTextJa,
      translatedText: translations.translatedText,
    })
    .from(episodes)
    .innerJoin(
      translations,
      and(
        eq(translations.episodeId, episodes.id),
        eq(translations.targetLanguage, "ko"),
        eq(translations.status, "available"),
      ),
    )
    .where(eq(episodes.novelId, novelId))
    .orderBy(asc(episodes.episodeNumber))
    .limit(maxEpisodes);

  if (rows.length === 0) {
    throw new Error("No translated episodes available for glossary generation");
  }

  // Build paired text samples
  const pairedText = rows.map((row) => {
    const header = `--- Episode ${row.episodeNumber}: ${row.titleJa ?? ""} ---`;
    const jp = row.sourceText ?? "";
    const kr = row.translatedText ?? "";
    // Truncate each episode to ~3000 chars to stay within token limits
    const jpTruncated = jp.length > 3000 ? jp.slice(0, 3000) + "\n[...]" : jp;
    const krTruncated = kr.length > 3000 ? kr.slice(0, 3000) + "\n[...]" : kr;
    return `${header}\n\n[Japanese]\n${jpTruncated}\n\n[Korean Translation]\n${krTruncated}`;
  }).join("\n\n");

  const modelName = modelOverride || env.OPENROUTER_DEFAULT_MODEL;
  const apiKey = env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shosetu-reader.local",
      "X-Title": "Shosetu Reader",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: GLOSSARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze the following ${rows.length} episodes and create a glossary and translation guideline:\n\n${pairedText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No glossary content in OpenRouter response");
  }

  const glossary = content.trim();

  // Upsert into novel_glossaries
  const [existing] = await db
    .select({ id: novelGlossaries.id })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  if (existing) {
    await db
      .update(novelGlossaries)
      .set({
        glossary,
        modelName,
        episodeCount: rows.length,
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novelGlossaries.id, existing.id));
  } else {
    await db.insert(novelGlossaries).values({
      novelId,
      glossary,
      modelName,
      episodeCount: rows.length,
      generatedAt: new Date(),
    });
  }

  return { glossary, modelName, episodeCount: rows.length };
}

/**
 * Estimate the input size for glossary generation without calling the LLM.
 * Returns the number of available episodes and estimated input character count.
 */
export async function estimateGlossaryInput(
  novelId: string,
  maxEpisodes = 10,
): Promise<{ episodeCount: number; inputChars: number }> {
  const db = getDb();

  const rows = await db
    .select({
      sourceLen: sql<number>`length(${episodes.normalizedTextJa})`,
      translatedLen: sql<number>`length(${translations.translatedText})`,
    })
    .from(episodes)
    .innerJoin(
      translations,
      and(
        eq(translations.episodeId, episodes.id),
        eq(translations.targetLanguage, "ko"),
        eq(translations.status, "available"),
      ),
    )
    .where(eq(episodes.novelId, novelId))
    .orderBy(asc(episodes.episodeNumber))
    .limit(maxEpisodes);

  let inputChars = 0;
  for (const row of rows) {
    // Each episode contributes min(sourceLen, 3000) + min(translatedLen, 3000) + headers
    inputChars += Math.min(row.sourceLen ?? 0, 3000) + Math.min(row.translatedLen ?? 0, 3000) + 100;
  }
  // Add system prompt overhead (~500 chars)
  inputChars += 500;

  return { episodeCount: rows.length, inputChars };
}

/**
 * Get the saved glossary for a novel, if any.
 */
export async function getGlossary(novelId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      glossary: novelGlossaries.glossary,
      modelName: novelGlossaries.modelName,
      episodeCount: novelGlossaries.episodeCount,
      generatedAt: novelGlossaries.generatedAt,
    })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  return row ?? null;
}

/**
 * Update a glossary's text (manual edit).
 */
export async function updateGlossary(novelId: string, glossary: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: novelGlossaries.id })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  if (existing) {
    await db
      .update(novelGlossaries)
      .set({ glossary, updatedAt: new Date() })
      .where(eq(novelGlossaries.id, existing.id));
  } else {
    await db.insert(novelGlossaries).values({ novelId, glossary });
  }
}
