import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, episodes, translations } from "@/lib/db/schema";
import { lookupCachedTranslations } from "@/lib/translate-cache";
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

  // Cache-only lookup for novel-level title/summary too. registerNovel
  // already kicks off translateNovelMetadata as fire-and-forget; once that
  // settles the columns are populated and SSR no longer needs to translate.
  // Falling back to JP text on cache miss is much better than a 500.
  let titleKo = row.titleKo;
  let summaryKo = row.summaryKo;

  const textsToLookup: string[] = [];
  if (!titleKo) textsToLookup.push(row.titleJa);
  if (!summaryKo && row.summaryJa) textsToLookup.push(row.summaryJa);

  if (textsToLookup.length > 0) {
    const cache = await lookupCachedTranslations(textsToLookup);
    if (!titleKo) titleKo = cache.get(row.titleJa) ?? null;
    if (!summaryKo && row.summaryJa) summaryKo = cache.get(row.summaryJa) ?? null;

    // Persist back to novels table so future loads skip the cache lookup
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
    sourceId: row.sourceId,
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

  // Cache-only lookup so SSR doesn't block on OpenRouter for big novels.
  // Episode titles get translated by background jobs (or by the client-
  // side ranking page); SSR shows whichever titles already have a cached
  // translation and falls back to the JP title for the rest.
  const titlesToLookup = rows
    .map((r) => r.titleJa)
    .filter((t): t is string => t != null && t.trim() !== "");
  const titleCache = titlesToLookup.length > 0
    ? await lookupCachedTranslations(titlesToLookup)
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
