import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, novelGlossaries, novelGlossaryEntries } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { estimateCost } from "./cost-estimation";
import { importGlossaryEntries, type GlossaryEntryInput } from "./glossary-entries";

const GLOSSARY_SYSTEM_PROMPT = `You are a professional translation quality reviewer specializing in Japanese-to-Korean web novel translation.

Given the first episodes of a Japanese web novel alongside their Korean translations, produce:

1. A structured list of important glossary entries (character names, places, terms, skills, honorifics).
2. A prose-only style guide covering tone, register, speech patterns, and translation consistency notes.

Return ONLY a JSON object with exactly two fields:

{
  "entries": [
    {
      "term_ja": "Japanese term (kanji/kana)",
      "term_ko": "Korean rendering used in translation",
      "reading": "furigana/reading if determinable, otherwise null",
      "category": "character | place | term | skill | honorific",
      "notes": "brief context (one sentence max), or null",
      "importance": 1-5
    }
  ],
  "style_guide": "Prose-only markdown string in Korean. Cover: speech levels (격식체/비격식체), narrator voice, character-specific speech patterns, tense usage, localization philosophy, consistency notes. Do NOT include any term mappings here — those belong in entries."
}

Rules for entries:
- Extract proper nouns (character names, place names), unique terminology (skills, magic, titles), and critical recurring terms.
- Do NOT extract common words, adjectives, or generic descriptions.
- Importance scale: 1=minor reference, 2=supporting detail, 3=recurring term, 4=important character/concept, 5=main character/critical term.
- Maximum 30 entries. Prioritize by importance.
- Do not duplicate terms already listed below as existing entries.

Rules for style_guide:
- Write in Korean.
- Focus on translation style decisions, NOT term mappings.
- Cover: narrator voice, speech register per character, tense consistency, honorific handling, localization choices.
- Keep concise but actionable for a translator.`;

interface GlossaryResult {
  glossary: string;
  modelName: string;
  episodeCount: number;
  entriesImported: number;
  entriesSkipped: number;
}

/**
 * Generate a glossary from the first N translated episodes of a novel.
 * Produces both structured glossary entries and a prose-only style guide.
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

  // Load existing entries to provide context and avoid duplicates
  const existingEntries = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      status: novelGlossaryEntries.status,
    })
    .from(novelGlossaryEntries)
    .where(eq(novelGlossaryEntries.novelId, novelId));

  const confirmedTerms = existingEntries.filter((e) => e.status === "confirmed");
  const suggestedTerms = existingEntries.filter((e) => e.status === "suggested");
  const rejectedTerms = existingEntries.filter((e) => e.status === "rejected");

  const contextParts: string[] = [];
  if (confirmedTerms.length > 0) {
    contextParts.push(
      `\n\nConfirmed glossary entries (do not re-extract):\n${confirmedTerms.map((e) => `${e.termJa} → ${e.termKo}`).join(", ")}`,
    );
  }
  if (suggestedTerms.length > 0) {
    contextParts.push(
      `\n\nSuggested entries (already suggested — skip):\n${suggestedTerms.map((e) => e.termJa).join(", ")}`,
    );
  }
  if (rejectedTerms.length > 0) {
    contextParts.push(
      `\n\nRejected entries (rejected — do NOT re-suggest):\n${rejectedTerms.map((e) => e.termJa).join(", ")}`,
    );
  }
  const existingList = contextParts.join("");

  // Build paired text samples
  const pairedText = rows.map((row) => {
    const header = `--- Episode ${row.episodeNumber}: ${row.titleJa ?? ""} ---`;
    const jp = row.sourceText ?? "";
    const kr = row.translatedText ?? "";
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
          content: `Analyze the following ${rows.length} episodes and produce the glossary entries and style guide:\n\n${pairedText}${existingList}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      response_format: { type: "json_object" },
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

  // Estimate generation cost
  let generationCostUsd: number | null = null;
  const genInputTokens = data.usage?.prompt_tokens;
  const genOutputTokens = data.usage?.completion_tokens;
  if (genInputTokens != null && genOutputTokens != null) {
    generationCostUsd = await estimateCost(modelName, genInputTokens, genOutputTokens);
  }

  // Parse JSON response
  let rawEntries: Array<{
    term_ja?: string;
    term_ko?: string;
    reading?: string | null;
    category?: string;
    notes?: string | null;
    importance?: number;
  }> = [];
  let styleGuide = "";

  try {
    const parsed = JSON.parse(content);
    rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    styleGuide = typeof parsed.style_guide === "string" ? parsed.style_guide.trim() : "";
  } catch {
    // Fallback: try to extract JSON object from the response
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
        styleGuide = typeof parsed.style_guide === "string" ? parsed.style_guide.trim() : "";
      } catch {
        console.error("Failed to parse glossary generation response:", content.slice(0, 500));
        // Fall back to storing entire content as style guide
        styleGuide = content.trim();
      }
    } else {
      // No JSON found — treat entire response as style guide (backward compat)
      styleGuide = content.trim();
    }
  }

  // Validate and import entries
  const existingTermSet = new Set(existingEntries.map((e) => e.termJa));
  const validCategories = new Set(["character", "place", "term", "skill", "honorific"]);

  const entries: GlossaryEntryInput[] = rawEntries
    .filter((e) => e.term_ja && e.term_ko && e.category && validCategories.has(e.category))
    .filter((e) => !existingTermSet.has(e.term_ja!))
    .slice(0, 30)
    .map((e) => {
      const rawImportance = typeof e.importance === "number" ? e.importance : 3;
      const importance = Math.max(1, Math.min(5, Math.round(rawImportance)));
      return {
        termJa: e.term_ja!,
        termKo: e.term_ko!,
        reading: e.reading ?? undefined,
        category: e.category as GlossaryEntryInput["category"],
        notes: e.notes ?? undefined,
        status: "confirmed" as const,
        importance,
      };
    });

  let entriesImported = 0;
  let entriesSkipped = 0;

  if (entries.length > 0) {
    const result = await importGlossaryEntries(novelId, entries);
    entriesImported = result.imported;
    entriesSkipped = result.skipped;
  }

  // Upsert style guide into novel_glossaries
  const [existing] = await db
    .select({ id: novelGlossaries.id })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  if (existing) {
    await db
      .update(novelGlossaries)
      .set({
        glossary: styleGuide,
        modelName,
        episodeCount: rows.length,
        estimatedCostUsd: generationCostUsd,
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novelGlossaries.id, existing.id));
  } else {
    await db.insert(novelGlossaries).values({
      novelId,
      glossary: styleGuide,
      modelName,
      episodeCount: rows.length,
      estimatedCostUsd: generationCostUsd,
      generatedAt: new Date(),
    });
  }

  return {
    glossary: styleGuide,
    modelName,
    episodeCount: rows.length,
    entriesImported,
    entriesSkipped,
  };
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
    inputChars += Math.min(row.sourceLen ?? 0, 3000) + Math.min(row.translatedLen ?? 0, 3000) + 100;
  }
  // Add system prompt overhead (~800 chars for the longer prompt)
  inputChars += 800;

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
