import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations } from "@/lib/db/schema";
import { estimateTranslationProgress } from "@/modules/translation/application/estimate-translation-progress";
import { getLatestNovelJob } from "@/modules/jobs/application/job-runs";
import { createEmptyNovelStatusOverview, getNovelStatusOverviews } from "./get-novel-status-overviews";

export interface NovelLiveEpisode {
  id: string;
  episodeNumber: number;
  titleJa: string | null;
  titleKo: string | null;
  fetchStatus: "pending" | "fetching" | "fetched" | "failed";
  hasTranslation: boolean;
  translationStatus: "queued" | "processing" | "available" | "failed" | null;
  translationModel: string | null;
  translationProgressPercent: number | null;
  publishedAt: string | null;
}

export async function getNovelLiveStatus(novelId: string) {
  const db = getDb();

  const latestTranslations = db
    .selectDistinctOn([translations.episodeId], {
      episodeId: translations.episodeId,
      status: translations.status,
      modelName: translations.modelName,
      processingStartedAt: translations.processingStartedAt,
    })
    .from(translations)
    .where(eq(translations.targetLanguage, "ko"))
    .orderBy(translations.episodeId, desc(translations.createdAt))
    .as("latest_translations");

  const rows = await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      titleJa: episodes.titleJa,
      normalizedTextJa: episodes.normalizedTextJa,
      fetchStatus: episodes.fetchStatus,
      publishedAt: episodes.publishedAt,
      translationStatus: latestTranslations.status,
      translationModel: latestTranslations.modelName,
      processingStartedAt: latestTranslations.processingStartedAt,
    })
    .from(episodes)
    .leftJoin(latestTranslations, eq(episodes.id, latestTranslations.episodeId))
    .where(eq(episodes.novelId, novelId))
    .orderBy(episodes.episodeNumber);

  const [statusMap, job] = await Promise.all([
    getNovelStatusOverviews([novelId]),
    getLatestNovelJob(novelId),
  ]);

  const episodeItems: NovelLiveEpisode[] = [];

  for (const row of rows) {
    const progressEstimate = row.translationStatus === "processing" && row.normalizedTextJa
      ? await estimateTranslationProgress({
          modelName: row.translationModel ?? "",
          sourceText: row.normalizedTextJa,
          processingStartedAt: row.processingStartedAt,
        })
      : null;

    episodeItems.push({
      id: row.id,
      episodeNumber: row.episodeNumber,
      titleJa: row.titleJa,
      titleKo: null,
      fetchStatus: row.fetchStatus,
      hasTranslation: row.translationStatus === "available",
      translationStatus: row.translationStatus as NovelLiveEpisode["translationStatus"],
      translationModel: row.translationModel ?? null,
      translationProgressPercent: progressEstimate?.progressPercent ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    });
  }

  return {
    job: job
      ? {
          id: job.id,
          jobType: job.jobType,
          status: job.status,
          result: job.resultJson,
        }
      : null,
    episodes: episodeItems,
    totalCount: episodeItems.length,
    statusOverview: statusMap[novelId] ?? createEmptyNovelStatusOverview(),
  };
}
