import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  episodes,
  jobRuns,
  translationSessions,
  translations,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";

const CANCEL_REASON = "cancelled by user";

export interface CancelNovelWorkResult {
  cancelledJobs: number;
  cancelledTranslations: number;
  cancelledSessions: number;
}

/**
 * Halts all queued background work for a novel:
 *
 * - any active translation session is set to "cancelled" (advanceSession()
 *   already short-circuits on non-active status)
 * - every job_run with status='queued' for this novel is marked failed with
 *   resultJson.errorMessage = "cancelled by user" so the worker won't claim it
 * - every translation row with status in ('queued','processing') for this
 *   novel's episodes is marked failed with the same reason so the next
 *   bulk-translate run doesn't immediately requeue
 *
 * Currently-running jobs are not aborted — the worker has no in-flight
 * cancellation hook. Those finish their current step but won't enqueue more.
 */
export async function cancelNovelWork(
  novelId: string,
): Promise<CancelNovelWorkResult> {
  const db = getDb();
  const now = new Date();

  const sessionRows = await db
    .update(translationSessions)
    .set({ status: "cancelled", updatedAt: now })
    .where(
      and(
        eq(translationSessions.novelId, novelId),
        eq(translationSessions.status, "active"),
      ),
    )
    .returning({ id: translationSessions.id });

  const queuedJobs = await db
    .update(jobRuns)
    .set({
      status: "failed",
      resultJson: { errorMessage: CANCEL_REASON } as Record<string, unknown>,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobRuns.entityType, "novel"),
        eq(jobRuns.entityId, novelId),
        eq(jobRuns.status, "queued"),
      ),
    )
    .returning({ id: jobRuns.id });

  const novelEpisodes = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(eq(episodes.novelId, novelId));

  const episodeIds = novelEpisodes.map((e) => e.id);
  let translationCount = 0;
  if (episodeIds.length > 0) {
    const translationRows = await db
      .update(translations)
      .set({
        status: "failed",
        errorMessage: CANCEL_REASON,
        completedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(translations.episodeId, episodeIds),
          inArray(translations.status, ["queued", "processing"]),
        ),
      )
      .returning({ id: translations.id });
    translationCount = translationRows.length;
  }

  logger.info("Cancelled novel background work", {
    novelId,
    cancelledJobs: queuedJobs.length,
    cancelledTranslations: translationCount,
    cancelledSessions: sessionRows.length,
  });

  return {
    cancelledJobs: queuedJobs.length,
    cancelledTranslations: translationCount,
    cancelledSessions: sessionRows.length,
  };
}
