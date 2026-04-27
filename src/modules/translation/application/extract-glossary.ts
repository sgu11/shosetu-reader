import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, novelGlossaryEntries } from "@/lib/db/schema";
import { env, resolveModel } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordOpenRouterError, recordOpenRouterUsage } from "@/lib/ops-metrics";
import { estimateCost } from "./cost-estimation";
import { importGlossaryEntries, type GlossaryEntryInput } from "./glossary-entries";
import { promoteSuggestedEntries } from "./promote-suggested-entries";
import { validateTermsAgainstCorpus } from "./validate-terms";

const EXTRACT_TRUNC_CHARS = 6000;
const RECENT_CONTEXT_EPISODES = 10;
const REJECTED_CONTEXT_LIMIT = 20;

const EXTRACTION_SYSTEM_PROMPT = `You are a glossary extraction assistant for Japanese-to-Korean web novel translation.

Given a Japanese source text and its Korean translation, extract only the most important terms.

Extract only proper nouns (character names, place names), unique terminology (skills, magic, titles), and critical recurring terms. Do NOT extract common words, adjectives, generic descriptions, or terms that appear only once. Maximum 5 entries.

Return ONLY a JSON array. Each element must have exactly these fields:
- "term_ja": the Japanese term (kanji/kana)
- "term_ko": the Korean rendering used in the translation
- "reading": furigana/reading (if determinable, otherwise null)
- "category": one of "character", "place", "term", "skill", "honorific"
- "notes": brief context (one sentence max, or null)
- "importance": integer 1-5 (1=minor reference, 2=supporting detail, 3=recurring term, 4=important character/concept, 5=main character/critical term)

Rules:
- Only extract terms that appear as deliberate translation choices (names, places, skills, titles)
- Do not extract common words or grammar patterns
- Do not duplicate terms already listed below
- Be very selective — only the most important 5 terms per episode
- Output ONLY the JSON array, no other text`;

export interface ExtractGlossaryPayload {
  novelId: string;
  episodeId: string;
  episodeNumber: number;
  translationId: string;
}

export async function extractGlossaryTerms(
  payload: ExtractGlossaryPayload,
): Promise<{ imported: number; skipped: number }> {
  const db = getDb();
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  // Load episode source and translation
  const [episode] = await db
    .select({ sourceText: episodes.normalizedTextJa })
    .from(episodes)
    .where(eq(episodes.id, payload.episodeId))
    .limit(1);

  const [translation] = await db
    .select({ translatedText: translations.translatedText })
    .from(translations)
    .where(eq(translations.id, payload.translationId))
    .limit(1);

  if (!episode?.sourceText || !translation?.translatedText) {
    return { imported: 0, skipped: 0 };
  }

  // Stage-2 cold-start: validate suggested (bootstrap-mined) entries
  // against this episode's pair. Reinforces matches and decays
  // mistranslated guesses. Pure DB work, no LLM call. Failures here
  // never block extraction.
  try {
    await promoteSuggestedEntries(
      payload.novelId,
      episode.sourceText,
      translation.translatedText,
      payload.episodeNumber,
    );
  } catch (err) {
    logger.warn("promoteSuggestedEntries failed (non-fatal)", {
      novelId: payload.novelId,
      episodeNumber: payload.episodeNumber,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Dedup set: ALL existing termJa (whatever status)
  const allExisting = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      status: novelGlossaryEntries.status,
      sourceEpisodeNumber: novelGlossaryEntries.sourceEpisodeNumber,
    })
    .from(novelGlossaryEntries)
    .where(eq(novelGlossaryEntries.novelId, payload.novelId));

  const existingTerms = new Set(allExisting.map((e) => e.termJa));

  // Recency-pruned context: only pass confirmed+suggested that appeared within
  // RECENT_CONTEXT_EPISODES of this episode, plus a capped sample of rejected.
  const recencyFloor = payload.episodeNumber - RECENT_CONTEXT_EPISODES;
  const confirmedRecent = allExisting.filter(
    (e) =>
      e.status === "confirmed" &&
      (e.sourceEpisodeNumber == null || e.sourceEpisodeNumber >= recencyFloor),
  );
  const suggestedRecent = allExisting.filter(
    (e) =>
      e.status === "suggested" &&
      (e.sourceEpisodeNumber == null || e.sourceEpisodeNumber >= recencyFloor),
  );
  const rejectedAll = allExisting.filter((e) => e.status === "rejected");
  const rejectedSample = rejectedAll.slice(-REJECTED_CONTEXT_LIMIT);

  const contextParts: string[] = [];
  if (confirmedRecent.length > 0) {
    contextParts.push(
      `\n\nConfirmed glossary entries (recent — do not re-extract):\n${confirmedRecent.map((e) => e.termJa).join(", ")}`,
    );
  }
  if (suggestedRecent.length > 0) {
    contextParts.push(
      `\n\nSuggested entries (recent — skip):\n${suggestedRecent.map((e) => e.termJa).join(", ")}`,
    );
  }
  if (rejectedSample.length > 0) {
    const moreCount = rejectedAll.length - rejectedSample.length;
    const moreSuffix = moreCount > 0 ? ` (+${moreCount} older rejected)` : "";
    contextParts.push(
      `\n\nRejected entries (do NOT re-suggest):\n${rejectedSample.map((e) => e.termJa).join(", ")}${moreSuffix}`,
    );
  }
  const existingList = contextParts.join("");

  // Truncate texts for cost control
  const sourceTruncated = episode.sourceText.slice(0, EXTRACT_TRUNC_CHARS);
  const translatedTruncated = translation.translatedText.slice(0, EXTRACT_TRUNC_CHARS);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shosetu-reader.local",
      "X-Title": "Shosetu Reader",
    },
    body: JSON.stringify({
      model: resolveModel("extraction"),
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Episode ${payload.episodeNumber}:\n\n[Japanese]\n${sourceTruncated}\n\n[Korean Translation]\n${translatedTruncated}${existingList}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    await recordOpenRouterError("glossary.extract", res.status);
    throw new Error(`Extraction API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { imported: 0, skipped: 0 };

  // Log extraction cost for visibility
  const extractInputTokens = data.usage?.prompt_tokens;
  const extractOutputTokens = data.usage?.completion_tokens;
  if (extractInputTokens != null && extractOutputTokens != null) {
    const cost = await estimateCost(resolveModel("extraction"), extractInputTokens, extractOutputTokens);
    if (cost != null) {
      await recordOpenRouterUsage({
        operation: "glossary.extract",
        modelName: resolveModel("extraction"),
        inputTokens: extractInputTokens,
        outputTokens: extractOutputTokens,
        costUsd: cost,
      });
      logger.info("Glossary extraction cost", {
        novelId: payload.novelId,
        episodeNumber: payload.episodeNumber,
        inputTokens: extractInputTokens,
        outputTokens: extractOutputTokens,
        costUsd: cost,
      });
    }
  }

  // Parse the JSON response
  let rawEntries: Array<{
    term_ja?: string;
    term_ko?: string;
    reading?: string | null;
    category?: string;
    notes?: string | null;
    importance?: number;
  }>;

  try {
    const parsed = JSON.parse(content);
    rawEntries = Array.isArray(parsed) ? parsed : (parsed.entries ?? parsed.terms ?? []);
  } catch {
    // Try to extract JSON array from the response
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("Failed to parse extraction response:", content.slice(0, 500));
      return { imported: 0, skipped: 0 };
    }
    try {
      rawEntries = JSON.parse(match[0]);
    } catch {
      console.error("Failed to parse extracted JSON array:", match[0].slice(0, 500));
      return { imported: 0, skipped: 0 };
    }
  }

  // Validate and convert entries — cap at 5 per episode, auto-register as confirmed
  const validCategories = new Set(["character", "place", "term", "skill", "honorific"]);
  const mappedEntries: GlossaryEntryInput[] = rawEntries
    .filter((e) => e.term_ja && e.term_ko && e.category && validCategories.has(e.category))
    .filter((e) => !existingTerms.has(e.term_ja!))
    .slice(0, 5)
    .map((e) => {
      const rawImportance = typeof e.importance === "number" ? e.importance : 3;
      const importance = Math.max(1, Math.min(5, Math.round(rawImportance)));
      return {
        termJa: e.term_ja!,
        termKo: e.term_ko!,
        reading: e.reading ?? undefined,
        category: e.category as GlossaryEntryInput["category"],
        notes: e.notes ?? undefined,
        sourceEpisodeNumber: payload.episodeNumber,
        status: "confirmed" as const,
        importance,
        provenanceTranslationId: payload.translationId,
      };
    });

  // Grep validation gate: drop hallucinations
  const { accepted: entries, rejected: droppedByValidation } = validateTermsAgainstCorpus(
    mappedEntries,
    {
      sourceTexts: [episode.sourceText],
      translatedTexts: [translation.translatedText],
    },
  );
  if (droppedByValidation.length > 0) {
    logger.info("Extract-glossary validation dropped terms", {
      novelId: payload.novelId,
      episodeNumber: payload.episodeNumber,
      droppedCount: droppedByValidation.length,
      sampleDropped: droppedByValidation.slice(0, 3).map((d) => ({
        termJa: d.term.termJa,
        reason: d.reason,
      })),
    });
  }

  if (entries.length === 0) return { imported: 0, skipped: 0 };

  return importGlossaryEntries(payload.novelId, entries);
}
