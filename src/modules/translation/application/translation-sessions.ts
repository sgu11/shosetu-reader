import { eq, and, asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  episodes,
  translations,
  translationSessions,
  translationSettings,
  novelGlossaries,
  novelGlossaryEntries,
} from "@/lib/db/schema";
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
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import { SYSTEM_OWNER_USER_ID } from "../domain/constants";
import { computePromptFingerprint } from "./prompt-fingerprint";
import { estimateCost } from "./cost-estimation";
import { renderGlossaryPrompt } from "./render-glossary-prompt";
import { processQueuedTranslation } from "./request-translation";

export interface SessionAdvancePayload {
  sessionId: string;
  novelId: string;
  episodeIds: string[];
  currentIndex: number;
  reorderAttempts?: number;
  /** Number of transient upstream failures on the current episode. */
  translationAttempts?: number;
}

const MAX_REORDER_RETRIES = 5;
const MAX_TRANSIENT_TRANSLATION_RETRIES = 4;

/**
 * Classify whether a translation error looks transient (upstream rate limit,
 * provider outage, empty response) and therefore worth retrying the same
 * episode, versus permanent (malformed request, auth, schema) where we should
 * skip the episode and advance the session.
 */
function isTransientTranslationError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b(429|502|503|504)\b/.test(msg)) return true;
  if (/rate[- ]?limit/i.test(msg)) return true;
  if (/No translation content/i.test(msg)) return true;
  if (/timed? out|timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) return true;
  return false;
}

export interface SessionSummaryPayload {
  sessionId: string;
  novelId: string;
  episodeId: string;
  translationId: string;
  episodeNumber: number;
  /** Episode IDs remaining after this one */
  episodeIds: string[];
  currentIndex: number;
}

/**
 * Create a new translation session for bulk sequential translation.
 * Returns the session ID and enqueues the first session-advance job.
 */
export async function createTranslationSession(
  novelId: string,
  episodeIds: string[],
  modelNameOverride?: string,
): Promise<{ sessionId: string }> {
  const db = getDb();
  const userId = await resolveUserId();

  // Load user settings
  const [settings] = await db
    .select({
      modelName: translationSettings.modelName,
      globalPrompt: translationSettings.globalPrompt,
    })
    .from(translationSettings)
    .where(eq(translationSettings.userId, userId))
    .limit(1);

  const modelName = modelNameOverride ?? settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL;
  const globalPrompt = settings?.globalPrompt ?? "";

  // Load glossary version
  const [glossaryRow] = await db
    .select({
      glossary: novelGlossaries.glossary,
      glossaryVersion: novelGlossaries.glossaryVersion,
    })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, novelId))
    .limit(1);

  const glossaryVersion = glossaryRow?.glossaryVersion ?? 1;

  const fingerprint = computePromptFingerprint({
    provider: "openrouter",
    modelName,
    promptVersion: "v3",
    globalPrompt,
    styleGuide: glossaryRow?.glossary ?? "",
    glossaryVersion,
    sessionMode: true,
  });

  // Create session
  const [session] = await db
    .insert(translationSessions)
    .values({
      novelId,
      status: "active",
      modelName,
      glossaryVersion,
      promptFingerprint: fingerprint,
      creatorUserId: userId,
      expectedNextIndex: 0,
      globalPrompt,
      costBudgetUsd: env.TRANSLATION_COST_BUDGET_USD ?? null,
    })
    .returning({ id: translationSessions.id });

  // Enqueue first session-advance
  const jobQueue = getJobQueue();
  await jobQueue.enqueue(
    "translation.session-advance",
    {
      sessionId: session.id,
      novelId,
      episodeIds,
      currentIndex: 0,
    } as SessionAdvancePayload,
    {
      entityType: "novel",
      entityId: novelId,
    },
  );

  return { sessionId: session.id };
}

/**
 * Advance a session: translate the next episode in sequence.
 */
export async function advanceSession(
  payload: SessionAdvancePayload,
): Promise<void> {
  const db = getDb();

  if (payload.currentIndex >= payload.episodeIds.length) {
    // All episodes done — mark session complete and run a deferred
    // glossary refresh. Per-episode extract was skipped during this
    // session to keep the prompt prefix stable for cache hits; refresh
    // catches up across the full session range with a single LLM call.
    await db
      .update(translationSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
    try {
      const jobQueue = getJobQueue();
      await jobQueue.enqueue(
        "glossary.refresh",
        { novelId: payload.novelId },
        { entityType: "novel", entityId: payload.novelId },
      );
    } catch (err) {
      logger.warn("Failed to enqueue session-end glossary refresh", {
        sessionId: payload.sessionId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  const episodeId = payload.episodeIds[payload.currentIndex];

  // Load session
  const [session] = await db
    .select()
    .from(translationSessions)
    .where(eq(translationSessions.id, payload.sessionId))
    .limit(1);

  if (!session || session.status !== "active") return;

  // Cost budget check — pause session if budget exceeded
  if (session.costBudgetUsd != null && session.totalCostUsd >= session.costBudgetUsd) {
    await db
      .update(translationSessions)
      .set({ status: "paused_budget", updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
    logger.info("Session paused — cost budget exceeded", {
      sessionId: payload.sessionId,
      totalCostUsd: session.totalCostUsd,
      costBudgetUsd: session.costBudgetUsd,
    });
    return;
  }

  // Ordering guard — re-enqueue out-of-order advances with backoff
  if (payload.currentIndex !== session.expectedNextIndex) {
    const attempts = (payload.reorderAttempts ?? 0) + 1;
    if (attempts > MAX_REORDER_RETRIES) {
      logger.error("Session advance permanently out-of-order; dropping", {
        sessionId: payload.sessionId,
        expectedNextIndex: session.expectedNextIndex,
        actualIndex: payload.currentIndex,
        attempts,
      });
      return;
    }
    logger.warn("Session advance out-of-order; re-enqueueing with backoff", {
      sessionId: payload.sessionId,
      expectedNextIndex: session.expectedNextIndex,
      actualIndex: payload.currentIndex,
      attempts,
    });
    const jobQueue = getJobQueue();
    await jobQueue.enqueue(
      "translation.session-advance",
      { ...payload, reorderAttempts: attempts } as SessionAdvancePayload,
      {
        entityType: "translation-session",
        entityId: payload.sessionId,
        delayMs: 5_000 * attempts,
      },
    );
    return;
  }

  // Load episode
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode?.normalizedTextJa) {
    // Skip episodes without source text, advance to next
    const jobQueue = getJobQueue();
    await db
      .update(translationSessions)
      .set({ expectedNextIndex: payload.currentIndex + 1, updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
    await jobQueue.enqueue(
      "translation.session-advance",
      {
        ...payload,
        currentIndex: payload.currentIndex + 1,
      } as SessionAdvancePayload,
      {
        entityType: "novel",
        entityId: payload.novelId,
      },
    );
    return;
  }

  // Use session's stored globalPrompt (captured at creation time)
  const globalPrompt = session.globalPrompt ?? "";

  // Load structured glossary for prompt
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
        eq(novelGlossaryEntries.novelId, payload.novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    )
    .orderBy(
      asc(novelGlossaryEntries.category),
      asc(novelGlossaryEntries.termJa),
    );

  const [glossaryRow] = await db
    .select({ glossary: novelGlossaries.glossary })
    .from(novelGlossaries)
    .where(eq(novelGlossaries.novelId, payload.novelId))
    .limit(1);

  const glossaryPrompt = renderGlossaryPrompt(
    confirmedEntries,
    glossaryRow?.glossary ?? "",
  );

  const sourceChecksum = episode.rawHtmlChecksum ?? "unknown";
  const fingerprint = session.promptFingerprint ?? "";

  // Create translation row linked to session
  const [row] = await db
    .insert(translations)
    .values({
      episodeId,
      targetLanguage: "ko",
      provider: "openrouter",
      modelName: session.modelName,
      promptVersion: "v3",
      sourceChecksum,
      promptFingerprint: fingerprint,
      sessionId: session.id,
      status: "queued",
    })
    .onConflictDoNothing()
    .returning({ id: translations.id });

  const translationId = row?.id;

  if (!translationId) {
    // Already exists — skip and advance
    const jobQueue = getJobQueue();
    await db
      .update(translationSessions)
      .set({ expectedNextIndex: payload.currentIndex + 1, updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
    await jobQueue.enqueue(
      "translation.session-advance",
      {
        ...payload,
        currentIndex: payload.currentIndex + 1,
      } as SessionAdvancePayload,
      {
        entityType: "novel",
        entityId: payload.novelId,
      },
    );
    return;
  }

  // Process translation directly (inline, not via separate job)
  try {
    const ownerUserId = session.creatorUserId ?? SYSTEM_OWNER_USER_ID;
    await processQueuedTranslation({
      translationId,
      episodeId,
      novelId: payload.novelId,
      ownerUserId,
      sourceText: episode.normalizedTextJa,
      provider: "openrouter",
      modelName: session.modelName,
      globalPrompt,
      glossary: glossaryPrompt,
      promptFingerprint: fingerprint,
      sessionId: session.id,
      contextSummary: session.contextSummary ?? undefined,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    const transient = isTransientTranslationError(err);
    const attempts = (payload.translationAttempts ?? 0) + 1;
    const jobQueue = getJobQueue();

    if (transient && attempts <= MAX_TRANSIENT_TRANSLATION_RETRIES) {
      // Reset translation row to queued so the next advance can re-run it.
      await db
        .update(translations)
        .set({
          status: "queued",
          errorCode: null,
          errorMessage: null,
          processingStartedAt: null,
          durationMs: null,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, translationId));
      // Exponential backoff: 15s, 30s, 60s, 120s (upstream rate windows).
      const delayMs = 15_000 * Math.pow(2, attempts - 1);
      logger.warn("Session translation transient failure; backing off same episode", {
        sessionId: payload.sessionId,
        episodeId,
        attempts,
        delayMs,
        error: errorMsg,
      });
      await jobQueue.enqueue(
        "translation.session-advance",
        {
          ...payload,
          translationAttempts: attempts,
        } as SessionAdvancePayload,
        {
          entityType: "novel",
          entityId: payload.novelId,
          delayMs,
        },
      );
      return;
    }

    // Permanent failure (or transient retries exhausted) — mark failed and advance.
    logger.error("Session translation failed; advancing past episode", {
      sessionId: payload.sessionId,
      episodeId,
      attempts,
      transient,
      error: errorMsg,
    });
    await db
      .update(translations)
      .set({
        status: "failed",
        errorCode: transient ? "TRANSIENT_EXHAUSTED" : "SESSION_ADVANCE_FAILED",
        errorMessage: errorMsg.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(translations.id, translationId));
    await db
      .update(translationSessions)
      .set({ expectedNextIndex: payload.currentIndex + 1, updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
    await jobQueue.enqueue(
      "translation.session-advance",
      {
        ...payload,
        currentIndex: payload.currentIndex + 1,
        translationAttempts: 0,
      } as SessionAdvancePayload,
      {
        entityType: "novel",
        entityId: payload.novelId,
      },
    );
    return;
  }

  // Translation succeeded — enqueue summary generation (which will advance to next)
  const jobQueue = getJobQueue();
  await jobQueue.enqueue(
    "translation.session-summary",
    {
      sessionId: payload.sessionId,
      novelId: payload.novelId,
      episodeId,
      translationId,
      episodeNumber: episode.episodeNumber,
      episodeIds: payload.episodeIds,
      currentIndex: payload.currentIndex,
    } as SessionSummaryPayload,
    {
      entityType: "novel",
      entityId: payload.novelId,
    },
  );
}

/**
 * Generate a rolling context summary after an episode translation completes.
 */
export async function generateSessionSummary(
  payload: SessionSummaryPayload,
): Promise<void> {
  const db = getDb();
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // No API key — skip summary, advance to next episode
    await enqueueNextAdvance(payload);
    return;
  }

  // Load episode and translation text
  const [episode] = await db
    .select({
      sourceText: episodes.normalizedTextJa,
      titleJa: episodes.titleJa,
    })
    .from(episodes)
    .where(eq(episodes.id, payload.episodeId))
    .limit(1);

  const [translation] = await db
    .select({
      translatedText: translations.translatedText,
      estimatedCostUsd: translations.estimatedCostUsd,
    })
    .from(translations)
    .where(eq(translations.id, payload.translationId))
    .limit(1);

  if (!episode?.sourceText || !translation?.translatedText) {
    await enqueueNextAdvance(payload);
    return;
  }

  // Load current session summary
  const [session] = await db
    .select({
      contextSummary: translationSessions.contextSummary,
      modelName: translationSessions.modelName,
    })
    .from(translationSessions)
    .where(eq(translationSessions.id, payload.sessionId))
    .limit(1);

  if (!session) {
    await enqueueNextAdvance(payload);
    return;
  }

  const previousSummary =
    session.contextSummary ??
    "No prior context — this is the beginning of the story.";
  const sourceTruncated = episode.sourceText.slice(0, 3000);
  const translatedTruncated = translation.translatedText.slice(0, 3000);

  const summaryPrompt = `You are a story context summarizer for a Japanese web novel translation pipeline.

Given the previous rolling summary and the latest episode, produce a REPLACEMENT summary (not an append) that captures:
1. Key plot events up to and including this episode
2. Active characters and their current relationships/status
3. Current mood/tone of the narrative
4. Any unresolved plot threads

Keep the summary under 2000 characters. Write in English for cross-model compatibility.
Output ONLY the summary text, no headers or labels.`;

  const summaryModel = resolveModel("summary");

  try {
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
        model: summaryModel,
        messages: [
          { role: "system", content: summaryPrompt },
          {
            role: "user",
            content: `Previous summary:\n${previousSummary}\n\n--- Episode ${payload.episodeNumber}: ${episode.titleJa ?? ""} ---\n\n[Japanese excerpt]\n${sourceTruncated}\n\n[Korean translation excerpt]\n${translatedTruncated}`,
          },
        ],
        temperature: 0.2,
        max_tokens: resolveWorkloadProfile("summary").maxTokens,
        ...buildOpenRouterRoutingBody("summary", summaryModel),
      }),
    });

    if (!res.ok) {
      await recordOpenRouterError("translation.session-summary", res.status);
      logger.warn("Summary generation failed", {
        sessionId: payload.sessionId,
        status: res.status,
      });
    } else {
      const data = await res.json();
      const summary = data.choices?.[0]?.message?.content?.trim();

      // Estimate summary generation cost
      let summaryCostUsd = 0;
      const summaryInputTokens = data.usage?.prompt_tokens;
      const summaryOutputTokens = data.usage?.completion_tokens;
      if (summaryInputTokens != null && summaryOutputTokens != null) {
        summaryCostUsd = await estimateCost(
          summaryModel,
          summaryInputTokens,
          summaryOutputTokens,
        ) ?? 0;
        const telemetry = extractUsageTelemetry(data.usage);
        await recordOpenRouterUsage({
          operation: "translation.session-summary",
          modelName: summaryModel,
          inputTokens: summaryInputTokens,
          outputTokens: summaryOutputTokens,
          cacheHitTokens: telemetry.cacheHitTokens,
          cacheMissTokens: telemetry.cacheMissTokens,
          reasoningTokens: telemetry.reasoningTokens,
          costUsd: summaryCostUsd,
        });
      }

      if (summary) {
        // Update session with new summary, progress, and combined cost (translation + summary)
        const translationCost = translation.estimatedCostUsd ?? 0;
        await db
          .update(translationSessions)
          .set({
            contextSummary: summary.slice(0, 2500),
            lastEpisodeNumber: payload.episodeNumber,
            episodeCount: sql`${translationSessions.episodeCount} + 1`,
            totalCostUsd: sql`${translationSessions.totalCostUsd} + ${translationCost + summaryCostUsd}`,
            updatedAt: new Date(),
          })
          .where(eq(translationSessions.id, payload.sessionId));
      }
    }
  } catch (err) {
    logger.warn("Failed to generate session summary", {
      sessionId: payload.sessionId,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // Advance to next episode regardless of summary success
  await enqueueNextAdvance(payload);
}

async function enqueueNextAdvance(payload: SessionSummaryPayload) {
  const db = getDb();
  const jobQueue = getJobQueue();
  await db
    .update(translationSessions)
    .set({ expectedNextIndex: payload.currentIndex + 1, updatedAt: new Date() })
    .where(eq(translationSessions.id, payload.sessionId));
  await jobQueue.enqueue(
    "translation.session-advance",
    {
      sessionId: payload.sessionId,
      novelId: payload.novelId,
      episodeIds: payload.episodeIds,
      currentIndex: payload.currentIndex + 1,
    } as SessionAdvancePayload,
    {
      entityType: "novel",
      entityId: payload.novelId,
    },
  );
}
