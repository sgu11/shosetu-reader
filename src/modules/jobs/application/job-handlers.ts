import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema";
import { translateTexts } from "@/lib/translate-cache";
import {
  fetchPendingEpisodes,
  reingestNovelByChecksum,
} from "@/modules/catalog/application/ingest-episodes";
import { refreshSubscribedNovelMetadata } from "@/modules/catalog/application/refresh-metadata";
import { extractGlossaryTerms, type ExtractGlossaryPayload } from "@/modules/translation/application/extract-glossary";
import { generateGlossary } from "@/modules/translation/application/generate-glossary";
import { requestTranslation, processQueuedTranslation, type TranslationJobPayload } from "@/modules/translation/application/request-translation";
import { advanceSession, generateSessionSummary, type SessionAdvancePayload, type SessionSummaryPayload } from "@/modules/translation/application/translation-sessions";
import type { JobExecutionContext } from "./job-queue";
import type { JobRunResult } from "./job-runs";
import type { JobKind } from "../domain/job-kind";

export interface IngestAllJobPayload {
  novelId: string;
  limit: number;
  discovered: number;
  ownerUserId: string;
  /**
   * When true, iterate all fetched episodes and reconcile against their
   * stored checksum. Unchanged episodes skip DB writes. Used by V5.3
   * selective re-ingest.
   */
  reconcile?: boolean;
}

export interface BulkTranslateAllJobPayload {
  novelId: string;
  episodeIds: string[];
  ownerUserId: string;
}

export interface MetadataRefreshPayload {
  triggeredBy: "schedule" | "manual";
}

export interface GlossaryGeneratePayload {
  novelId: string;
  modelName?: string;
}

type JobHandler<TPayload = unknown> = (
  payload: TPayload,
  context: JobExecutionContext<TPayload>,
) => Promise<JobRunResult | void>;

const jobHandlers: {
  [K in JobKind]: JobHandler<unknown>;
} = {
  "catalog.ingest-all": handleIngestAll as JobHandler<unknown>,
  "catalog.metadata-refresh": handleMetadataRefresh as JobHandler<unknown>,
  "glossary.generate": handleGlossaryGenerate as JobHandler<unknown>,
  "glossary.extract": handleGlossaryExtract as JobHandler<unknown>,
  "translation.bulk-translate-all": handleBulkTranslateAll as JobHandler<unknown>,
  "translation.episode": handleEpisodeTranslation as JobHandler<unknown>,
  "translation.session-advance": handleSessionAdvance as JobHandler<unknown>,
  "translation.session-summary": handleSessionSummary as JobHandler<unknown>,
};

export function getJobHandler(kind: JobKind) {
  return jobHandlers[kind];
}

async function handleIngestAll(
  payload: IngestAllJobPayload,
  context: JobExecutionContext<IngestAllJobPayload>,
) {
  await context.updateProgress({
    stage: payload.reconcile ? "reconciling" : "fetching",
    discovered: payload.discovered,
    processed: 0,
    total: 0,
    fetched: 0,
    failed: 0,
  });

  let result:
    | { fetched: number; failed: number; total: number }
    | { unchanged: number; updated: number; failed: number; total: number };

  if (payload.reconcile) {
    const r = await reingestNovelByChecksum(payload.novelId, async (progress) => {
      await context.updateProgress({
        stage: "reconciling",
        discovered: payload.discovered,
        ...progress,
      });
    });
    result = r;
  } else {
    result = await fetchPendingEpisodes(
      payload.novelId,
      payload.limit,
      async (progress) => {
        await context.updateProgress({
          stage: "fetching",
          discovered: payload.discovered,
          ...progress,
        });
      },
    );
  }

  // Batch-translate episode titles so first novel page load is instant
  try {
    const db = getDb();
    const episodeRows = await db
      .select({ titleJa: episodes.titleJa })
      .from(episodes)
      .where(eq(episodes.novelId, payload.novelId));
    const titles = episodeRows
      .map((r) => r.titleJa)
      .filter((t): t is string => t != null && t.trim() !== "");
    if (titles.length > 0) {
      await translateTexts(titles);
    }
  } catch {
    // Non-fatal — titles will be translated on demand
  }

  return {
    stage: "completed",
    discovered: payload.discovered,
    ...result,
  };
}

async function handleBulkTranslateAll(
  payload: BulkTranslateAllJobPayload,
  context: JobExecutionContext<BulkTranslateAllJobPayload>,
) {
  let queued = 0;
  let failed = 0;
  const total = payload.episodeIds.length;

  await context.updateProgress({
    stage: "queueing",
    processed: 0,
    total,
    queued,
    failed,
  });

  for (const [index, episodeId] of payload.episodeIds.entries()) {
    try {
      await requestTranslation(episodeId);
      queued++;
    } catch {
      failed++;
    }

    await context.updateProgress({
      stage: "queueing",
      processed: index + 1,
      total,
      queued,
      failed,
      currentEpisodeId: episodeId,
    });
  }

  return {
    stage: "completed",
    processed: total,
    total,
    queued,
    failed,
  };
}

async function handleEpisodeTranslation(
  payload: TranslationJobPayload,
  context: JobExecutionContext<TranslationJobPayload>,
) {
  await context.updateProgress({
    stage: "processing",
    processed: 0,
    total: 1,
  });

  await processQueuedTranslation(payload);

  return {
    stage: "completed",
    processed: 1,
    total: 1,
  };
}

async function handleGlossaryExtract(
  payload: ExtractGlossaryPayload,
  context: JobExecutionContext<ExtractGlossaryPayload>,
) {
  await context.updateProgress({
    stage: "extracting",
    processed: 0,
    total: 1,
  });

  const result = await extractGlossaryTerms(payload);

  return {
    stage: "completed",
    ...result,
  };
}

async function handleGlossaryGenerate(
  payload: GlossaryGeneratePayload,
  context: JobExecutionContext<GlossaryGeneratePayload>,
) {
  await context.updateProgress({
    stage: "generating",
    processed: 0,
    total: 1,
  });

  const result = await generateGlossary(payload.novelId, payload.modelName);

  return {
    stage: "completed",
    processed: 1,
    total: 1,
    glossary: result.glossary,
    modelName: result.modelName,
    episodeCount: result.episodeCount,
    entriesImported: result.entriesImported,
    entriesSkipped: result.entriesSkipped,
  };
}

async function handleMetadataRefresh(
  _payload: MetadataRefreshPayload,
  context: JobExecutionContext<MetadataRefreshPayload>,
) {
  await context.updateProgress({ stage: "refreshing", processed: 0, total: 0 });

  const result = await refreshSubscribedNovelMetadata(async (progress) => {
    await context.updateProgress(progress);
  });

  return {
    stage: "completed",
    ...result,
  };
}

async function handleSessionAdvance(
  payload: SessionAdvancePayload,
  context: JobExecutionContext<SessionAdvancePayload>,
) {
  await context.updateProgress({
    stage: "advancing",
    currentIndex: payload.currentIndex,
    total: payload.episodeIds.length,
  });

  await advanceSession(payload);

  return {
    stage: "completed",
    currentIndex: payload.currentIndex,
    total: payload.episodeIds.length,
  };
}

async function handleSessionSummary(
  payload: SessionSummaryPayload,
  context: JobExecutionContext<SessionSummaryPayload>,
) {
  await context.updateProgress({
    stage: "summarizing",
    episodeNumber: payload.episodeNumber,
  });

  await generateSessionSummary(payload);

  return {
    stage: "completed",
    episodeNumber: payload.episodeNumber,
  };
}
