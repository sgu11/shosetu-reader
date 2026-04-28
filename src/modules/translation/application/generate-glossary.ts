import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, novelGlossaries, novelGlossaryEntries } from "@/lib/db/schema";
import { buildOpenRouterRoutingBody, env, resolveModel } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  extractUsageTelemetry,
  recordOpenRouterError,
  recordOpenRouterUsage,
} from "@/lib/ops-metrics";
import { estimateCost } from "./cost-estimation";
import { importGlossaryEntries, type GlossaryEntryInput } from "./glossary-entries";
import { stratifiedEpisodeSample } from "./sample-strategy";
import { validateTermsAgainstCorpus } from "./validate-terms";
import { mineCandidates, type MorphCandidate } from "../infra/morph-analyzer";

const PER_EPISODE_CHAR_BUDGET = 6000;
const FETCH_POOL_LIMIT = 40;
const GLOSSARY_ENTRY_MAX = 30;
const CANDIDATE_TOP_N = 80;

const STYLE_GUIDE_SYSTEM_PROMPT = `You are a professional translation quality reviewer for Japanese-to-Korean web novel translation.

Given paired Japanese source and Korean translation excerpts, write a concise style guide in Korean.

Return ONLY a JSON object with this shape:
{
  "style_guide": "markdown string in Korean with the following H2 sections in order"
}

Required sections (use these exact Korean headings):
## 말투 / 화자
## 호칭 / 존대
## 시제
## 음차 vs 번역 정책
## 문단 리듬 / 대사 스타일

Rules:
- No term mappings (those live in a separate glossary). Focus on style decisions only.
- Each section: 2-4 bullets, actionable, specific to this novel.
- Keep total length under 1500 characters.`;

const GLOSSARY_SYSTEM_PROMPT = `You are a glossary translation assistant for Japanese-to-Korean web novel translation.

You will receive:
1. A list of CANDIDATE Japanese terms mined from the source text (with frequency counts and suggested categories).
2. Paired Japanese source and Korean translation excerpts for grounding.
3. Any existing confirmed/suggested/rejected entries to avoid duplicating.

For each candidate term that appears as a deliberate translation choice in the Korean excerpts, return an entry mapping it to the Korean rendering actually used in the translation. Drop candidates that are generic words, grammatical fragments, or not translated as a proper noun / named concept.

Return ONLY a JSON object:
{
  "entries": [
    {
      "term_ja": "exact Japanese term from candidates",
      "term_ko": "exact Korean rendering from translation excerpts",
      "reading": "furigana/reading if determinable, else null",
      "category": "character | place | term | skill | honorific",
      "notes": "brief context (<=80 chars), or null",
      "importance": 1-5
    }
  ]
}

Rules:
- Only include terms whose term_ja literally appears in the candidate list AND the Japanese excerpts.
- term_ko must appear verbatim in the Korean excerpts.
- Maximum ${GLOSSARY_ENTRY_MAX} entries. Prioritize by candidate frequency.
- Skip candidates already listed as confirmed/suggested/rejected below.
- Importance scale: 1=minor reference, 2=supporting detail, 3=recurring term, 4=important character/concept, 5=main character/critical term.`;

export interface GlossaryResult {
  glossary: string;
  modelName: string;
  episodeCount: number;
  entriesImported: number;
  entriesSkipped: number;
}

type RawEntry = {
  term_ja?: string;
  term_ko?: string;
  reading?: string | null;
  category?: string;
  notes?: string | null;
  importance?: number;
};

interface EpisodePair {
  episodeNumber: number;
  titleJa: string | null;
  sourceText: string;
  translatedText: string;
}

function truncate(s: string, limit: number): string {
  if (s.length <= limit) return s;
  return `${s.slice(0, limit)}\n[...]`;
}

function renderPairedExcerpts(rows: EpisodePair[]): string {
  return rows
    .map((row) => {
      const header = `--- Episode ${row.episodeNumber}: ${row.titleJa ?? ""} ---`;
      const jp = truncate(row.sourceText, PER_EPISODE_CHAR_BUDGET);
      const kr = truncate(row.translatedText, PER_EPISODE_CHAR_BUDGET);
      return `${header}\n\n[Japanese]\n${jp}\n\n[Korean Translation]\n${kr}`;
    })
    .join("\n\n");
}

function renderCandidateList(candidates: MorphCandidate[]): string {
  if (candidates.length === 0) return "";
  const lines = candidates.map((c, i) => {
    const reading = c.reading ? ` [${c.reading}]` : "";
    return `${i + 1}. ${c.term}${reading} — freq ${c.frequency}, hint: ${c.category}`;
  });
  return `\n\nCandidate terms (frequency-mined from source; translate + validate):\n${lines.join("\n")}`;
}

async function callOpenRouter(params: {
  operation: "glossary.generate" | "glossary.style";
  modelName: string;
  apiKey: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
}): Promise<{ content: string; costUsd: number | null }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://shosetu-reader.local",
      "X-Title": "Shosetu Reader",
    },
    body: JSON.stringify({
      model: params.modelName,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userContent },
      ],
      temperature: 0.3,
      max_tokens: params.maxTokens,
      response_format: { type: "json_object" },
      // Both operations are structured-JSON single-shots over a small
      // pinned window of episodes — extraction-class workload. Mapping
      // glossary.style to 'compare' previously dragged it into reasoning
      // HIGH on V4 Pro, which then spent the 2048 max_tokens budget on
      // thinking and truncated the actual style-guide payload.
      ...buildOpenRouterRoutingBody("extraction", params.modelName),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    await recordOpenRouterError(params.operation, res.status);
    throw new Error(`OpenRouter API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const finishReason = data.choices?.[0]?.finish_reason as string | undefined;

  if (finishReason === "length") {
    logger.warn(`${params.operation} response truncated by max_tokens`, {
      operation: params.operation,
      model: params.modelName,
      maxTokens: params.maxTokens,
      outputTokens: data.usage?.completion_tokens,
      reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens,
      contentChars: content.length,
    });
  }

  let costUsd: number | null = null;
  const inputTokens = data.usage?.prompt_tokens;
  const outputTokens = data.usage?.completion_tokens;
  if (inputTokens != null && outputTokens != null) {
    costUsd = await estimateCost(params.modelName, inputTokens, outputTokens);
    const telemetry = extractUsageTelemetry(data.usage);
    await recordOpenRouterUsage({
      operation: params.operation,
      modelName: params.modelName,
      inputTokens,
      outputTokens,
      cacheHitTokens: telemetry.cacheHitTokens,
      cacheMissTokens: telemetry.cacheMissTokens,
      reasoningTokens: telemetry.reasoningTokens,
      costUsd,
    });
  }

  return { content, costUsd };
}

function parseStyleGuide(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed.style_guide === "string") return parsed.style_guide.trim();
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.style_guide === "string") return parsed.style_guide.trim();
      } catch {
        // fall through
      }
    }
  }
  return content.trim();
}

function parseGlossaryEntries(content: string): RawEntry[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.entries)) return parsed.entries;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.entries)) return parsed.entries;
      } catch {
        logger.warn("Failed to parse glossary entries", { preview: content.slice(0, 500) });
      }
    }
  }
  return [];
}

/**
 * Generate a glossary from translated episodes of a novel using a two-pass
 * approach: morph-mined candidates → LLM translation/validation for entries,
 * plus a separate voice-focused style guide pass.
 */
export async function generateGlossary(
  novelId: string,
  modelOverride?: string,
  maxEpisodes = 10,
): Promise<GlossaryResult> {
  const db = getDb();

  const availableRows = await db
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
    .limit(FETCH_POOL_LIMIT);

  if (availableRows.length === 0) {
    throw new Error("No translated episodes available for glossary generation");
  }

  const normalized: EpisodePair[] = availableRows
    .filter((r) => r.sourceText && r.translatedText)
    .map((r) => ({
      episodeNumber: r.episodeNumber,
      titleJa: r.titleJa ?? null,
      sourceText: r.sourceText ?? "",
      translatedText: r.translatedText ?? "",
    }));

  const sampled = stratifiedEpisodeSample(normalized, maxEpisodes);
  const styleRows = sampled.slice(0, 3);

  // Load existing entries — pass only terms to LLM, dedup by termJa
  const existingEntries = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      status: novelGlossaryEntries.status,
    })
    .from(novelGlossaryEntries)
    .where(eq(novelGlossaryEntries.novelId, novelId));

  const existingTermSet = new Set(existingEntries.map((e) => e.termJa));
  const confirmedTerms = existingEntries.filter((e) => e.status === "confirmed");
  const suggestedTerms = existingEntries.filter((e) => e.status === "suggested");
  const rejectedTerms = existingEntries.filter((e) => e.status === "rejected");

  const contextParts: string[] = [];
  if (confirmedTerms.length > 0) {
    contextParts.push(
      `\n\nConfirmed glossary entries (skip — already present):\n${confirmedTerms.map((e) => `${e.termJa} → ${e.termKo}`).join(", ")}`,
    );
  }
  if (suggestedTerms.length > 0) {
    contextParts.push(
      `\n\nSuggested entries (skip):\n${suggestedTerms.map((e) => e.termJa).join(", ")}`,
    );
  }
  if (rejectedTerms.length > 0) {
    contextParts.push(
      `\n\nRejected entries (do NOT re-suggest):\n${rejectedTerms.map((e) => e.termJa).join(", ")}`,
    );
  }
  const existingList = contextParts.join("");

  const modelName = modelOverride || resolveModel("extraction");
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  // Pass A: style guide (first 3 episodes, voice-focused)
  const styleExcerpts = renderPairedExcerpts(styleRows.length > 0 ? styleRows : sampled.slice(0, 3));
  const stylePromise = callOpenRouter({
    operation: "glossary.style",
    modelName,
    apiKey,
    systemPrompt: STYLE_GUIDE_SYSTEM_PROMPT,
    userContent: `Analyze these ${styleRows.length} early episodes and produce the style guide:\n\n${styleExcerpts}`,
    // 2048 was tight even at reasoning OFF; with any reasoning overhead
    // the structured-JSON tail truncated. 4096 leaves headroom while
    // still well under the workload-profile cap.
    maxTokens: 4096,
  });

  // Mine JP candidates across ALL sampled episodes (stratified, untruncated)
  const candidates = await mineCandidates(
    sampled.map((r) => r.sourceText),
    { topN: CANDIDATE_TOP_N, minFrequency: 2 },
  );
  const filteredCandidates = candidates.filter((c) => !existingTermSet.has(c.term));

  // Pass B: glossary entries (candidates + excerpts)
  const entryExcerpts = renderPairedExcerpts(sampled);
  const entryPromise = callOpenRouter({
    operation: "glossary.generate",
    modelName,
    apiKey,
    systemPrompt: GLOSSARY_SYSTEM_PROMPT,
    userContent:
      `Translate and validate candidate terms using these ${sampled.length} episode excerpts:\n\n${entryExcerpts}${renderCandidateList(filteredCandidates)}${existingList}`,
    maxTokens: 8192,
  });

  const [styleResp, entryResp] = await Promise.all([stylePromise, entryPromise]);
  const styleGuide = parseStyleGuide(styleResp.content);
  const rawEntries = parseGlossaryEntries(entryResp.content);

  const validCategories = new Set(["character", "place", "term", "skill", "honorific"]);
  const mapped: GlossaryEntryInput[] = rawEntries
    .filter((e) => e.term_ja && e.term_ko && e.category && validCategories.has(e.category))
    .filter((e) => !existingTermSet.has(e.term_ja!))
    .slice(0, GLOSSARY_ENTRY_MAX)
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

  // Validation gate: term_ja must appear in JP corpus, term_ko in KR corpus
  const { accepted, rejected: droppedByValidation } = validateTermsAgainstCorpus(
    mapped.map((m) => ({ ...m, termJa: m.termJa, termKo: m.termKo })),
    {
      sourceTexts: sampled.map((r) => r.sourceText),
      translatedTexts: sampled.map((r) => r.translatedText),
    },
  );

  if (droppedByValidation.length > 0) {
    logger.info("Glossary validation dropped terms", {
      novelId,
      droppedCount: droppedByValidation.length,
      sampleDropped: droppedByValidation.slice(0, 5).map((d) => ({
        termJa: d.term.termJa,
        reason: d.reason,
      })),
    });
  }

  let entriesImported = 0;
  let entriesSkipped = 0;
  if (accepted.length > 0) {
    const result = await importGlossaryEntries(novelId, accepted);
    entriesImported = result.imported;
    entriesSkipped = result.skipped;
  }

  const totalCostUsd =
    (styleResp.costUsd ?? 0) + (entryResp.costUsd ?? 0) || null;

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
        episodeCount: sampled.length,
        estimatedCostUsd: totalCostUsd,
        generatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novelGlossaries.id, existing.id));
  } else {
    await db.insert(novelGlossaries).values({
      novelId,
      glossary: styleGuide,
      modelName,
      episodeCount: sampled.length,
      estimatedCostUsd: totalCostUsd,
      generatedAt: new Date(),
    });
  }

  return {
    glossary: styleGuide,
    modelName,
    episodeCount: sampled.length,
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
    inputChars +=
      Math.min(row.sourceLen ?? 0, PER_EPISODE_CHAR_BUDGET) +
      Math.min(row.translatedLen ?? 0, PER_EPISODE_CHAR_BUDGET) +
      100;
  }
  inputChars += 1600; // two system prompts now

  return { episodeCount: rows.length, inputChars };
}

/**
 * Replace only the style-guide text for a novel (leaves entries untouched).
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
