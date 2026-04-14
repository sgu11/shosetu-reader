import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, episodes, translations } from "@/lib/db/schema";
import { translateTexts } from "@/lib/translate-cache";
import type { NovelResponse, EpisodeListItem } from "../api/schemas";
import { createEmptyNovelStatusOverview, getNovelStatusOverviews } from "./get-novel-status-overviews";

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

  // Translate title and summary if not already cached in novels table
  let titleKo = row.titleKo;
  let summaryKo = row.summaryKo;

  const textsToTranslate: string[] = [];
  if (!titleKo) textsToTranslate.push(row.titleJa);
  if (!summaryKo && row.summaryJa) textsToTranslate.push(row.summaryJa);

  if (textsToTranslate.length > 0) {
    const cache = await translateTexts(textsToTranslate);
    if (!titleKo) titleKo = cache.get(row.titleJa) ?? null;
    if (!summaryKo && row.summaryJa) summaryKo = cache.get(row.summaryJa) ?? null;

    // Persist back to novels table so future loads skip the translation lookup
    const updates: Record<string, unknown> = {};
    if (titleKo && !row.titleKo) updates.titleKo = titleKo;
    if (summaryKo && !row.summaryKo) updates.summaryKo = summaryKo;
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date();
      db.update(novels).set(updates).where(eq(novels.id, row.id)).then(() => {}, () => {});
    }
  }

  const statusMap = await getNovelStatusOverviews([row.id]);

  return {
    id: row.id,
    sourceNcode: row.sourceNcode,
    sourceUrl: row.sourceUrl,
    titleJa: row.titleJa,
    titleKo,
    titleNormalized: row.titleNormalized,
    authorName: row.authorName,
    summaryJa: row.summaryJa,
    summaryKo,
    isCompleted: row.isCompleted,
    totalEpisodes: row.totalEpisodes,
    lastSourceSyncAt: row.lastSourceSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    statusOverview: statusMap[row.id] ?? createEmptyNovelStatusOverview(),
  };
}

export async function getEpisodesByNovelId(
  novelId: string,
): Promise<{ episodes: EpisodeListItem[]; totalCount: number }> {
  const db = getDb();

  const latestTranslation = db
    .selectDistinctOn([translations.episodeId], {
      episodeId: translations.episodeId,
      status: translations.status,
      modelName: translations.modelName,
    })
    .from(translations)
    .where(eq(translations.targetLanguage, "ko"))
    .orderBy(translations.episodeId, desc(translations.createdAt))
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

  // Collect non-number episode titles for translation
  const titlesToTranslate = rows
    .map((r) => r.titleJa)
    .filter((t): t is string => t != null && t.trim() !== "");
  const titleCache = titlesToTranslate.length > 0
    ? await translateTexts(titlesToTranslate)
    : new Map<string, string>();

  const items: EpisodeListItem[] = rows.map((row) => ({
    id: row.id,
    episodeNumber: row.episodeNumber,
    titleJa: row.titleJa,
    titleKo: row.titleJa ? (titleCache.get(row.titleJa) ?? null) : null,
    fetchStatus: row.fetchStatus,
    hasTranslation: row.translationStatus === "available",
    translationStatus: row.translationStatus as EpisodeListItem["translationStatus"],
    translationModel: row.translationModel ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }));

  return { episodes: items, totalCount: items.length };
}
