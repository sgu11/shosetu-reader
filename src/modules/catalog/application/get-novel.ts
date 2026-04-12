import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, episodes, translations } from "@/lib/db/schema";
import type { NovelResponse, EpisodeListItem } from "../api/schemas";

export async function getNovelById(
  novelId: string,
): Promise<NovelResponse | null> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    sourceNcode: row.sourceNcode,
    sourceUrl: row.sourceUrl,
    titleJa: row.titleJa,
    titleKo: row.titleKo,
    titleNormalized: row.titleNormalized,
    authorName: row.authorName,
    summaryJa: row.summaryJa,
    summaryKo: row.summaryKo,
    isCompleted: row.isCompleted,
    totalEpisodes: row.totalEpisodes,
    lastSourceSyncAt: row.lastSourceSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getEpisodesByNovelId(
  novelId: string,
): Promise<{ episodes: EpisodeListItem[]; totalCount: number }> {
  const db = getDb();

  // Subquery: latest translation per episode (most recent by created_at)
  const latestTranslation = db
    .select({
      episodeId: translations.episodeId,
      status: translations.status,
      modelName: translations.modelName,
    })
    .from(translations)
    .where(
      and(
        eq(translations.targetLanguage, "ko"),
        sql`${translations.createdAt} = (
          SELECT MAX(t2.created_at) FROM translations t2
          WHERE t2.episode_id = ${translations.episodeId}
            AND t2.target_language = 'ko'
        )`,
      ),
    )
    .as("latest_tr");

  const rows = await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      titleJa: episodes.titleJa,
      fetchStatus: episodes.fetchStatus,
      publishedAt: episodes.publishedAt,
      translationStatus: latestTranslation.status,
      translationModel: latestTranslation.modelName,
    })
    .from(episodes)
    .leftJoin(latestTranslation, eq(episodes.id, latestTranslation.episodeId))
    .where(eq(episodes.novelId, novelId))
    .orderBy(episodes.episodeNumber);

  const items: EpisodeListItem[] = rows.map((row) => ({
    id: row.id,
    episodeNumber: row.episodeNumber,
    titleJa: row.titleJa,
    fetchStatus: row.fetchStatus,
    hasTranslation: row.translationStatus === "available",
    translationStatus: row.translationStatus as EpisodeListItem["translationStatus"],
    translationModel: row.translationModel ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }));

  return { episodes: items, totalCount: items.length };
}
