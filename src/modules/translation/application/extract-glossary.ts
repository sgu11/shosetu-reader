import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, novelGlossaryEntries } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { importGlossaryEntries, type GlossaryEntryInput } from "./glossary-entries";

const EXTRACTION_SYSTEM_PROMPT = `You are a glossary extraction assistant for Japanese-to-Korean web novel translation.

Given a Japanese source text and its Korean translation, extract proper nouns, recurring terms, and notable translation choices.

Return ONLY a JSON array. Each element must have exactly these fields:
- "term_ja": the Japanese term (kanji/kana)
- "term_ko": the Korean rendering used in the translation
- "reading": furigana/reading (if determinable, otherwise null)
- "category": one of "character", "place", "term", "skill", "honorific"
- "notes": brief context (one sentence max, or null)

Rules:
- Only extract terms that appear as deliberate translation choices (names, places, skills, titles)
- Do not extract common words or grammar patterns
- Do not duplicate terms already in the existing glossary
- Keep the list concise — max 30 entries per episode
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

  // Load existing confirmed entries to avoid duplicates in the prompt
  const existingEntries = await db
    .select({ termJa: novelGlossaryEntries.termJa })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, payload.novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    );

  const existingTerms = new Set(existingEntries.map((e) => e.termJa));
  const existingList = existingEntries.length > 0
    ? `\n\nAlready in glossary (do not re-extract):\n${existingEntries.map((e) => e.termJa).join(", ")}`
    : "";

  // Truncate texts for cost control
  const sourceTruncated = episode.sourceText.slice(0, 4000);
  const translatedTruncated = translation.translatedText.slice(0, 4000);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shosetu-reader.local",
      "X-Title": "Shosetu Reader",
    },
    body: JSON.stringify({
      model: env.OPENROUTER_DEFAULT_MODEL,
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
    throw new Error(`Extraction API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { imported: 0, skipped: 0 };

  // Parse the JSON response
  let rawEntries: Array<{
    term_ja?: string;
    term_ko?: string;
    reading?: string | null;
    category?: string;
    notes?: string | null;
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

  // Validate and convert entries
  const validCategories = new Set(["character", "place", "term", "skill", "honorific"]);
  const entries: GlossaryEntryInput[] = rawEntries
    .filter((e) => e.term_ja && e.term_ko && e.category && validCategories.has(e.category))
    .filter((e) => !existingTerms.has(e.term_ja!))
    .slice(0, 30)
    .map((e) => ({
      termJa: e.term_ja!,
      termKo: e.term_ko!,
      reading: e.reading ?? undefined,
      category: e.category as GlossaryEntryInput["category"],
      notes: e.notes ?? undefined,
      sourceEpisodeNumber: payload.episodeNumber,
      status: "suggested" as const,
      provenanceTranslationId: payload.translationId,
    }));

  if (entries.length === 0) return { imported: 0, skipped: 0 };

  return importGlossaryEntries(payload.novelId, entries);
}
