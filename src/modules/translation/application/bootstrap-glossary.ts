import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, novelGlossaryEntries } from "@/lib/db/schema";
import {
  buildOpenRouterRoutingBody,
  env,
  resolveModel,
  resolveWorkloadProfile,
} from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  extractUsageTelemetry,
  recordOpenRouterError,
  recordOpenRouterUsage,
} from "@/lib/ops-metrics";
import { estimateCost } from "./cost-estimation";
import { importGlossaryEntries, type GlossaryEntryInput } from "./glossary-entries";
import { stratifiedEpisodeSample } from "./sample-strategy";
import { mineCandidates, type MorphCandidate } from "../infra/morph-analyzer";

const SAMPLE_SIZE = 20;
const CANDIDATE_TOP_N = 60;
const MIN_FREQUENCY = 2;
const BOOTSTRAP_CONFIDENCE = 0.4;
const SOURCE_TEXT_LIMIT = 8000;

const BOOTSTRAP_SYSTEM_PROMPT = `You are a glossary translation assistant for Japanese-to-Korean web novel translation.

You will receive a list of CANDIDATE Japanese terms mined from the source text by morphological analysis. No Korean translation exists yet — you are bootstrapping a first-pass glossary.

For each candidate that is a proper noun, named entity, special skill, place, or recurring made-up term, return its natural Korean rendering. Skip generic words, grammatical fragments, common nouns, and anything that wouldn't deserve a glossary entry.

Return ONLY a JSON object:
{
  "entries": [
    {
      "term_ja": "exact Japanese term from candidates",
      "term_ko": "natural Korean rendering",
      "reading": "furigana/reading if useful, else null",
      "category": "character | place | term | skill | honorific",
      "notes": "brief note (<=80 chars), or null",
      "importance": 1-5
    }
  ]
}

Rules:
- term_ja MUST exactly match a term in the candidate list. Do not invent terms.
- For character names, prefer Hangul transliteration of the original phonetics over translation.
- For place names, use natural Korean reading; transliterate if no idiomatic equivalent exists.
- For skills/magic/items, transliterate katakana faithfully; translate kanji terms naturally.
- Use the candidate's category hint unless clearly wrong. Override with confidence if so.
- Importance: 1=minor, 2=supporting, 3=recurring term, 4=important character/concept, 5=main character/critical term.
- Skip terms that are general vocabulary or grammar (の/こと/もの/etc.).
- Keep under 40 entries. Prioritize by candidate frequency.`;

type RawEntry = {
  term_ja?: string;
  term_ko?: string;
  reading?: string | null;
  category?: string;
  notes?: string | null;
  importance?: number;
};

export interface BootstrapGlossaryResult {
  modelName: string;
  episodeCount: number;
  candidateCount: number;
  entriesImported: number;
  entriesSkipped: number;
  costUsd: number | null;
}

function renderCandidateList(candidates: MorphCandidate[]): string {
  return candidates
    .map((c, i) => {
      const reading = c.reading ? ` [${c.reading}]` : "";
      return `${i + 1}. ${c.term}${reading} — freq ${c.frequency}, hint: ${c.category}`;
    })
    .join("\n");
}

function isValidCategory(
  s: unknown,
): s is GlossaryEntryInput["category"] {
  return (
    s === "character" ||
    s === "place" ||
    s === "term" ||
    s === "skill" ||
    s === "honorific"
  );
}

export function parseBootstrapEntries(
  content: string,
  candidateSet: Set<string>,
): GlossaryEntryInput[] {
  let parsed: { entries?: RawEntry[] } | RawEntry[] | null = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        logger.warn("bootstrap: failed to parse glossary JSON", {
          preview: content.slice(0, 300),
        });
        return [];
      }
    }
  }

  const raw: RawEntry[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.entries)
      ? parsed.entries
      : [];

  const out: GlossaryEntryInput[] = [];
  for (const r of raw) {
    if (typeof r.term_ja !== "string" || typeof r.term_ko !== "string") continue;
    const termJa = r.term_ja.trim();
    const termKo = r.term_ko.trim();
    if (!termJa || !termKo) continue;
    // Reject hallucinated terms not in the candidate list.
    if (!candidateSet.has(termJa)) continue;
    if (termJa === termKo) continue;
    const category = isValidCategory(r.category) ? r.category : "term";
    const importance = Math.max(1, Math.min(5, Math.round(r.importance ?? 3)));

    out.push({
      termJa,
      termKo,
      reading: typeof r.reading === "string" && r.reading.trim() ? r.reading.trim() : undefined,
      category,
      notes:
        typeof r.notes === "string" && r.notes.trim()
          ? r.notes.trim().slice(0, 80)
          : undefined,
      importance,
      status: "suggested",
      confidence: BOOTSTRAP_CONFIDENCE,
    });
  }

  return out;
}

async function callOpenRouter(params: {
  modelName: string;
  apiKey: string;
  systemPrompt: string;
  userContent: string;
}): Promise<{ content: string; costUsd: number | null }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
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
      temperature: 0.2,
      max_tokens: resolveWorkloadProfile("bootstrap").maxTokens,
      response_format: { type: "json_object" },
      ...buildOpenRouterRoutingBody("bootstrap", params.modelName),
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    await recordOpenRouterError("glossary.bootstrap", res.status);
    throw new Error(`OpenRouter API error ${res.status}: ${errorBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  let costUsd: number | null = null;
  const inputTokens = data.usage?.prompt_tokens;
  const outputTokens = data.usage?.completion_tokens;
  if (inputTokens != null && outputTokens != null) {
    costUsd = await estimateCost(params.modelName, inputTokens, outputTokens);
    const telemetry = extractUsageTelemetry(data.usage);
    await recordOpenRouterUsage({
      operation: "glossary.bootstrap",
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

/**
 * Cold-start glossary generation. Mines morphological candidates from the
 * Japanese source text alone, then asks the LLM to translate each candidate
 * to Korean without any KO grounding. Inserts entries as `suggested` with
 * low confidence so a downstream validation pass (or the user) can promote
 * them once real translations exist.
 *
 * Idempotent: existing termJa entries are not overwritten by importGlossaryEntries
 * unless they're already `suggested` (then refreshed).
 */
export async function bootstrapGlossary(
  novelId: string,
  modelOverride?: string,
  sampleSize = SAMPLE_SIZE,
): Promise<BootstrapGlossaryResult> {
  const db = getDb();
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const fetchedRows = await db
    .select({
      episodeNumber: episodes.episodeNumber,
      sourceText: episodes.normalizedTextJa,
    })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, novelId),
        eq(episodes.fetchStatus, "fetched"),
      ),
    )
    .orderBy(asc(episodes.episodeNumber));

  const usable = fetchedRows.filter(
    (r): r is { episodeNumber: number; sourceText: string } =>
      typeof r.sourceText === "string" && r.sourceText.trim().length > 0,
  );

  if (usable.length === 0) {
    throw new Error("No fetched episodes with source text — ingest first");
  }

  const sampled = stratifiedEpisodeSample(usable, sampleSize);
  const texts = sampled.map((r) => r.sourceText.slice(0, SOURCE_TEXT_LIMIT));

  const candidates = await mineCandidates(texts, {
    topN: CANDIDATE_TOP_N,
    minFrequency: MIN_FREQUENCY,
  });

  if (candidates.length === 0) {
    return {
      modelName: modelOverride || resolveModel("extraction"),
      episodeCount: sampled.length,
      candidateCount: 0,
      entriesImported: 0,
      entriesSkipped: 0,
      costUsd: null,
    };
  }

  // Pass already-known terms so the LLM doesn't waste output on duplicates.
  const existing = await db
    .select({ termJa: novelGlossaryEntries.termJa })
    .from(novelGlossaryEntries)
    .where(eq(novelGlossaryEntries.novelId, novelId));
  const existingSet = new Set(existing.map((e) => e.termJa));

  const fresh = candidates.filter((c) => !existingSet.has(c.term));
  if (fresh.length === 0) {
    return {
      modelName: modelOverride || resolveModel("extraction"),
      episodeCount: sampled.length,
      candidateCount: candidates.length,
      entriesImported: 0,
      entriesSkipped: 0,
      costUsd: null,
    };
  }

  const modelName = modelOverride || resolveModel("extraction");
  const userContent = `Translate these candidate Japanese terms (mined from a web novel) to Korean glossary entries.\n\nCandidates:\n${renderCandidateList(fresh)}`;

  const { content, costUsd } = await callOpenRouter({
    modelName,
    apiKey,
    systemPrompt: BOOTSTRAP_SYSTEM_PROMPT,
    userContent,
  });

  const candidateSet = new Set(fresh.map((c) => c.term));
  const inputs = parseBootstrapEntries(content, candidateSet);

  if (inputs.length === 0) {
    logger.warn("bootstrap: parsed zero entries from LLM response", {
      novelId,
      candidates: fresh.length,
    });
    return {
      modelName,
      episodeCount: sampled.length,
      candidateCount: candidates.length,
      entriesImported: 0,
      entriesSkipped: 0,
      costUsd,
    };
  }

  const { imported, skipped } = await importGlossaryEntries(novelId, inputs);

  return {
    modelName,
    episodeCount: sampled.length,
    candidateCount: candidates.length,
    entriesImported: imported,
    entriesSkipped: skipped,
    costUsd,
  };
}
