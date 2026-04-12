import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations, translationSettings, novelGlossaries, novelGlossaryEntries } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import { OpenRouterProvider } from "../infra/openrouter-provider";
import { estimateCost } from "./cost-estimation";
import { splitIntoChunks, reassembleChunks } from "./chunk-episode";
import { computePromptFingerprint } from "./prompt-fingerprint";
import { validateTranslation } from "./quality-validation";
import { renderGlossaryPrompt } from "./render-glossary-prompt";

const PROMPT_VERSION = "v2";

export interface TranslationJobPayload {
  translationId: string;
  episodeId: string;
  novelId: string;
  ownerUserId: string;
  sourceText: string;
  provider: "openrouter";
  modelName: string;
  globalPrompt: string;
  glossary: string;
  promptFingerprint: string;
  /** Present when translating inside a session */
  sessionId?: string;
  contextSummary?: string;
}

/**
 * Load user's translation settings (model + global prompt) and per-novel prompt.
 */
async function loadTranslationContext(novelId: string) {
  const db = getDb();
  const userId = await resolveUserId();

  const [settings] = await db
    .select({
      modelName: translationSettings.modelName,
      globalPrompt: translationSettings.globalPrompt,
    })
    .from(translationSettings)
    .where(eq(translationSettings.userId, userId))
    .limit(1);

  const [glossaryRow] = await db
    .select({
      glossary: novelGlossaries.glossary,
      glossaryVersion: novelGlossaries.glossaryVersion,
    })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  // Load confirmed structured glossary entries
  const confirmedEntries = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      reading: novelGlossaryEntries.reading,
      category: novelGlossaryEntries.category,
      notes: novelGlossaryEntries.notes,
      importance: novelGlossaryEntries.importance,
    })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    )
    .orderBy(asc(novelGlossaryEntries.category), asc(novelGlossaryEntries.termJa));

  const styleGuide = glossaryRow?.glossary ?? "";
  const glossaryPrompt = renderGlossaryPrompt(confirmedEntries, styleGuide);

  return {
    userId,
    modelName: settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL,
    globalPrompt: settings?.globalPrompt ?? "",
    glossary: glossaryPrompt,
    glossaryVersion: glossaryRow?.glossaryVersion ?? 1,
  };
}

/**
 * Request a Korean translation for an episode.
 * If a translation already exists with the same identity, returns it.
 * Otherwise, creates a queued row and immediately processes it.
 */
export async function requestTranslation(
  episodeId: string,
  modelOverride?: string,
): Promise<{ translationId: string; status: string }> {
  const db = getDb();

  // Fetch episode
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) {
    throw new Error("Episode not found");
  }

  if (!episode.normalizedTextJa) {
    throw new Error("Episode has no source text to translate");
  }

  const sourceChecksum = episode.rawHtmlChecksum ?? "unknown";

  // Load translation context (model, global prompt, novel prompt)
  const ctx = await loadTranslationContext(episode.novelId);

  const effectiveModel = modelOverride ?? ctx.modelName;

  const provider = new OpenRouterProvider(
    env.OPENROUTER_API_KEY ?? "",
    effectiveModel,
    ctx.globalPrompt,
    ctx.glossary,
  );

  const fingerprint = computePromptFingerprint({
    provider: provider.provider,
    modelName: provider.modelName,
    promptVersion: PROMPT_VERSION,
    globalPrompt: ctx.globalPrompt,
    styleGuide: ctx.glossary,
    glossaryVersion: ctx.glossaryVersion,
    sessionMode: false,
  });

  // Check for existing translation with same identity
  const [existing] = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.episodeId, episodeId),
        eq(translations.targetLanguage, "ko"),
        eq(translations.provider, provider.provider),
        eq(translations.modelName, provider.modelName),
        eq(translations.promptVersion, PROMPT_VERSION),
        eq(translations.sourceChecksum, sourceChecksum),
      ),
    )
    .limit(1);

  if (existing) {
    // Allow retrying failed translations
    if (existing.status === "failed") {
      await db
        .update(translations)
        .set({
          status: "queued",
          errorCode: null,
          errorMessage: null,
          completedAt: null,
          processingStartedAt: null,
          durationMs: null,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, existing.id));

      await enqueueTranslationJob({
        translationId: existing.id,
        episodeId,
        novelId: episode.novelId,
        ownerUserId: ctx.userId,
        sourceText: episode.normalizedTextJa,
        provider: provider.provider,
        modelName: provider.modelName,
        globalPrompt: ctx.globalPrompt,
        glossary: ctx.glossary,
        promptFingerprint: fingerprint,
      });

      return { translationId: existing.id, status: "queued" };
    }
    return { translationId: existing.id, status: existing.status };
  }

  // Insert queued row — use onConflictDoNothing to handle race conditions
  // where two concurrent requests both pass the `existing` check above.
  const [row] = await db
    .insert(translations)
    .values({
      episodeId,
      targetLanguage: "ko",
      provider: provider.provider,
      modelName: provider.modelName,
      promptVersion: PROMPT_VERSION,
      sourceChecksum,
      promptFingerprint: fingerprint,
      status: "queued",
    })
    .onConflictDoNothing()
    .returning({ id: translations.id });

  if (!row) {
    // Conflict: another request already inserted — fetch and return it
    const [conflict] = await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.episodeId, episodeId),
          eq(translations.targetLanguage, "ko"),
          eq(translations.provider, provider.provider),
          eq(translations.modelName, provider.modelName),
          eq(translations.promptVersion, PROMPT_VERSION),
          eq(translations.sourceChecksum, sourceChecksum),
        ),
      )
      .limit(1);
    return { translationId: conflict!.id, status: conflict!.status };
  }

  await enqueueTranslationJob({
    translationId: row.id,
    episodeId,
    novelId: episode.novelId,
    ownerUserId: ctx.userId,
    sourceText: episode.normalizedTextJa,
    provider: provider.provider,
    modelName: provider.modelName,
    globalPrompt: ctx.globalPrompt,
    glossary: ctx.glossary,
    promptFingerprint: fingerprint,
  });

  return { translationId: row.id, status: "queued" };
}

async function enqueueTranslationJob(payload: TranslationJobPayload) {
  const jobQueue = getJobQueue();

  await jobQueue.enqueue("translation.episode", payload, {
    entityType: "episode",
    entityId: payload.episodeId,
  });
}

export async function processQueuedTranslation(
  payload: TranslationJobPayload,
): Promise<void> {
  const db = getDb();
  const provider = new OpenRouterProvider(
    env.OPENROUTER_API_KEY ?? "",
    payload.modelName,
    payload.globalPrompt,
    payload.glossary,
  );

  const [translation] = await db
    .select({
      status: translations.status,
    })
    .from(translations)
    .where(eq(translations.id, payload.translationId))
    .limit(1);

  if (!translation) {
    throw new Error("Translation not found");
  }

  if (translation.status === "available") {
    return;
  }

  // Mark as processing, store session context if present
  await db
    .update(translations)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
      durationMs: null,
      contextSummaryUsed: payload.contextSummary ?? null,
      updatedAt: new Date(),
    })
    .where(eq(translations.id, payload.translationId));

  const providerStartTime = Date.now();

  try {
    const chunks = splitIntoChunks(payload.sourceText);
    const isChunked = chunks.length > 1;

    let finalTranslatedText: string;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let hasTokenInfo = true;
    let hadTruncation = false;

    if (!isChunked) {
      // Single-pass translation (original path)
      const result = await provider.translate({
        sourceText: payload.sourceText,
        sourceLanguage: "ja",
        targetLanguage: "ko",
      }, payload.contextSummary);

      finalTranslatedText = result.translatedText;
      if (result.finishReason === "length") hadTruncation = true;
      if (result.inputTokens != null && result.outputTokens != null) {
        totalInputTokens = result.inputTokens;
        totalOutputTokens = result.outputTokens;
      } else {
        hasTokenInfo = false;
      }
    } else {
      // Chunked translation: translate sequentially with continuity context
      const translatedChunks: string[] = [];
      let previousTail: string | undefined;

      for (const chunk of chunks) {
        const result = await provider.translate({
          sourceText: chunk.text,
          sourceLanguage: "ja",
          targetLanguage: "ko",
          previousChunkTranslation: previousTail,
          chunkLabel: `${chunk.index + 1}/${chunk.total}`,
        }, payload.contextSummary);

        translatedChunks.push(result.translatedText);
        if (result.finishReason === "length") hadTruncation = true;

        // Keep tail of this chunk's translation for next chunk's context
        previousTail = result.translatedText.slice(-500);

        if (result.inputTokens != null && result.outputTokens != null) {
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;
        } else {
          hasTokenInfo = false;
        }
      }

      finalTranslatedText = reassembleChunks(translatedChunks);
    }

    const costUsd = hasTokenInfo
      ? await estimateCost(provider.modelName, totalInputTokens, totalOutputTokens)
      : null;

    // Load confirmed glossary entries for quality validation
    const confirmedEntries = await db
      .select({
        termJa: novelGlossaryEntries.termJa,
        termKo: novelGlossaryEntries.termKo,
      })
      .from(novelGlossaryEntries)
      .where(
        and(
          eq(novelGlossaryEntries.novelId, payload.novelId),
          eq(novelGlossaryEntries.status, "confirmed"),
        ),
      );

    // Run quality validation checks
    const qualityWarnings = validateTranslation({
      sourceText: payload.sourceText,
      translatedText: finalTranslatedText,
      chunkCount: isChunked ? chunks.length : null,
      confirmedTerms: confirmedEntries.length > 0 ? confirmedEntries : undefined,
    });

    if (hadTruncation) {
      qualityWarnings.push({
        code: "API_TRUNCATION",
        message: "API returned finish_reason=length — output may be truncated despite retry with higher max_tokens",
        severity: "error",
      });
    }

    await db
      .update(translations)
      .set({
        status: "available",
        translatedText: finalTranslatedText,
        inputTokens: hasTokenInfo ? totalInputTokens : null,
        outputTokens: hasTokenInfo ? totalOutputTokens : null,
        estimatedCostUsd: costUsd,
        chunkCount: isChunked ? chunks.length : null,
        qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : null,
        durationMs: providerStartTime
          ? Date.now() - providerStartTime
          : null,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(translations.id, payload.translationId));

    // After successful translation, enqueue glossary extraction
    try {
      const [ep] = await db
        .select({ episodeNumber: episodes.episodeNumber })
        .from(episodes)
        .where(eq(episodes.id, payload.episodeId))
        .limit(1);
      if (ep) {
        const jobQueue = getJobQueue();
        await jobQueue.enqueue("glossary.extract", {
          novelId: payload.novelId,
          episodeId: payload.episodeId,
          episodeNumber: ep.episodeNumber,
          translationId: payload.translationId,
        }, {
          entityType: "episode",
          entityId: payload.episodeId,
        });
      }
    } catch (extractErr) {
      // Non-fatal: don't fail the translation if extraction enqueue fails
      console.error("Failed to enqueue glossary extraction:", extractErr);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await db
      .update(translations)
      .set({
        status: "failed",
        durationMs: providerStartTime
          ? Date.now() - providerStartTime
          : null,
        errorCode: "TRANSLATION_ERROR",
        errorMessage: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(translations.id, payload.translationId));

    throw err;
  }
}

/**
 * Enqueue a translation job for a session-managed episode.
 * The translation row is already created by advanceSession.
 */
export async function requestTranslationInSession(
  payload: TranslationJobPayload,
) {
  await enqueueTranslationJob(payload);
}
