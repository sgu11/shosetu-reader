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
import { env } from "@/lib/env";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import { computePromptFingerprint } from "./prompt-fingerprint";
import { renderGlossaryPrompt } from "./render-glossary-prompt";
import { processQueuedTranslation } from "./request-translation";

export interface SessionAdvancePayload {
  sessionId: string;
  novelId: string;
  episodeIds: string[];
  currentIndex: number;
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

  const modelName = settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL;
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
    // All episodes done — mark session complete
    await db
      .update(translationSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(translationSessions.id, payload.sessionId));
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

  // Load episode
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode?.normalizedTextJa) {
    // Skip episodes without source text, advance to next
    const jobQueue = getJobQueue();
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

  // Load user settings for this session's model
  const globalPrompt = await loadSessionGlobalPrompt();

  // Load structured glossary for prompt
  const confirmedEntries = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      reading: novelGlossaryEntries.reading,
      category: novelGlossaryEntries.category,
      notes: novelGlossaryEntries.notes,
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
    await processQueuedTranslation({
      translationId,
      episodeId,
      novelId: payload.novelId,
      ownerUserId: "",
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
    console.error(
      `Session ${payload.sessionId}: translation failed for episode ${episodeId}`,
      err,
    );
    // Continue to next episode even on failure
    const jobQueue = getJobQueue();
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

async function loadSessionGlobalPrompt(): Promise<string> {
  // For sessions, use the first available user's global prompt
  const db = getDb();
  const [settings] = await db
    .select({ globalPrompt: translationSettings.globalPrompt })
    .from(translationSettings)
    .limit(1);
  return settings?.globalPrompt ?? "";
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

  try {
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
          { role: "system", content: summaryPrompt },
          {
            role: "user",
            content: `Previous summary:\n${previousSummary}\n\n--- Episode ${payload.episodeNumber}: ${episode.titleJa ?? ""} ---\n\n[Japanese excerpt]\n${sourceTruncated}\n\n[Korean translation excerpt]\n${translatedTruncated}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      console.error("Summary generation failed:", res.status);
    } else {
      const data = await res.json();
      const summary = data.choices?.[0]?.message?.content?.trim();

      if (summary) {
        // Update session with new summary and progress
        await db
          .update(translationSessions)
          .set({
            contextSummary: summary.slice(0, 2500),
            lastEpisodeNumber: payload.episodeNumber,
            episodeCount: sql`${translationSessions.episodeCount} + 1`,
            totalCostUsd: sql`${translationSessions.totalCostUsd} + ${translation.estimatedCostUsd ?? 0}`,
            updatedAt: new Date(),
          })
          .where(eq(translationSessions.id, payload.sessionId));
      }
    }
  } catch (err) {
    console.error("Failed to generate session summary:", err);
  }

  // Advance to next episode regardless of summary success
  await enqueueNextAdvance(payload);
}

async function enqueueNextAdvance(payload: SessionSummaryPayload) {
  const jobQueue = getJobQueue();
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
