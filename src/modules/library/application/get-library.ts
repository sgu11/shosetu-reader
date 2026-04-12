import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscriptions, novels, readingProgress, episodes } from "@/lib/db/schema";
import { translateTexts } from "@/lib/translate-cache";
import { createEmptyNovelStatusOverview, getNovelStatusOverviews } from "@/modules/catalog/application/get-novel-status-overviews";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import type { LibraryItem } from "../api/schemas";

export async function getLibrary(): Promise<{
  items: LibraryItem[];
  totalCount: number;
}> {
  const userId = await resolveUserId();
  const db = getDb();

  // Subscriptions are universal (shared across profiles).
  // Reading progress is per-user.
  const rows = await db
    .select({
      novelId: novels.id,
      titleJa: novels.titleJa,
      titleKo: novels.titleKo,
      titleNormalized: novels.titleNormalized,
      authorName: novels.authorName,
      isCompleted: novels.isCompleted,
      totalEpisodes: novels.totalEpisodes,
      subscribedAt: subscriptions.subscribedAt,
      lastReadAt: readingProgress.lastReadAt,
      currentEpisodeId: readingProgress.currentEpisodeId,
      currentLanguage: readingProgress.currentLanguage,
    })
    .from(subscriptions)
    .innerJoin(novels, eq(subscriptions.novelId, novels.id))
    .leftJoin(
      readingProgress,
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.novelId, novels.id),
      ),
    )
    .where(eq(subscriptions.isActive, true))
    .orderBy(desc(sql`COALESCE(${readingProgress.lastReadAt}, ${subscriptions.subscribedAt})`));

  const [statusMap, currentEpisodeRows] = await Promise.all([
    getNovelStatusOverviews(rows.map((row) => row.novelId)),
    (() => {
      const currentEpisodeIds = rows
        .map((row) => row.currentEpisodeId)
        .filter((episodeId): episodeId is string => episodeId != null);

      if (currentEpisodeIds.length === 0) {
        return Promise.resolve([] as Array<{ id: string; episodeNumber: number }>);
      }

      return db
        .select({
          id: episodes.id,
          episodeNumber: episodes.episodeNumber,
        })
        .from(episodes)
        .where(inArray(episodes.id, currentEpisodeIds));
    })(),
  ]);

  const currentEpisodeNumberMap = new Map(
    currentEpisodeRows.map((row) => [row.id, row.episodeNumber]),
  );

  const items: LibraryItem[] = [];

  for (const row of rows) {
    items.push({
      novelId: row.novelId,
      titleJa: row.titleJa,
      titleKo: row.titleKo,
      titleNormalized: row.titleNormalized,
      authorName: row.authorName,
      isCompleted: row.isCompleted,
      totalEpisodes: row.totalEpisodes,
      subscribedAt: row.subscribedAt.toISOString(),
      lastReadAt: row.lastReadAt?.toISOString() ?? null,
      currentEpisodeNumber: row.currentEpisodeId
        ? (currentEpisodeNumberMap.get(row.currentEpisodeId) ?? null)
        : null,
      currentLanguage: row.currentLanguage ?? null,
      hasNewEpisodes: false, // TODO: compare totalEpisodes with last checked count
      statusOverview: statusMap[row.novelId] ?? createEmptyNovelStatusOverview(),
    });
  }

  return { items, totalCount: items.length };
}

export async function getContinueReading(): Promise<
  Array<{
    novelId: string;
    titleJa: string;
    titleKo: string | null;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string | null;
    episodeTitleKo: string | null;
    lastReadAt: string;
  }>
> {
  const userId = await resolveUserId();
  const db = getDb();

  const rows = await db
    .select({
      novelId: novels.id,
      titleJa: novels.titleJa,
      episodeId: readingProgress.currentEpisodeId,
      lastReadAt: readingProgress.lastReadAt,
    })
    .from(readingProgress)
    .innerJoin(novels, eq(readingProgress.novelId, novels.id))
    .innerJoin(
      subscriptions,
      and(
        eq(subscriptions.novelId, novels.id),
        eq(subscriptions.isActive, true),
      ),
    )
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.lastReadAt))
    .limit(5);

  const result = [];

  for (const row of rows) {
    const [ep] = await db
      .select({
        episodeNumber: episodes.episodeNumber,
        titleJa: episodes.titleJa,
      })
      .from(episodes)
      .where(eq(episodes.id, row.episodeId))
      .limit(1);

    if (ep) {
      result.push({
        novelId: row.novelId,
        titleJa: row.titleJa,
        episodeId: row.episodeId,
        episodeNumber: ep.episodeNumber,
        episodeTitle: ep.titleJa,
        lastReadAt: row.lastReadAt.toISOString(),
      });
    }
  }

  // Batch-translate novel titles and episode titles
  const textsToTranslate = [
    ...result.map((r) => r.titleJa),
    ...result.map((r) => r.episodeTitle).filter((t): t is string => t != null),
  ];
  const cache = textsToTranslate.length > 0
    ? await translateTexts(textsToTranslate)
    : new Map<string, string>();

  return result.map((r) => ({
    ...r,
    titleKo: cache.get(r.titleJa) ?? null,
    episodeTitleKo: r.episodeTitle ? (cache.get(r.episodeTitle) ?? null) : null,
  }));
}
