import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { subscriptions, novels, readingProgress, episodes } from "@/lib/db/schema";
import { ensureDefaultUser } from "@/lib/auth/default-user";
import type { LibraryItem } from "../api/schemas";

export async function getLibrary(): Promise<{
  items: LibraryItem[];
  totalCount: number;
}> {
  const userId = await ensureDefaultUser();
  const db = getDb();

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
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.isActive, true),
      ),
    )
    .orderBy(desc(sql`COALESCE(${readingProgress.lastReadAt}, ${subscriptions.subscribedAt})`));

  // Enrich with episode numbers for current reading position
  const items: LibraryItem[] = [];

  for (const row of rows) {
    let currentEpisodeNumber: number | null = null;

    if (row.currentEpisodeId) {
      const [ep] = await db
        .select({ episodeNumber: episodes.episodeNumber })
        .from(episodes)
        .where(eq(episodes.id, row.currentEpisodeId))
        .limit(1);
      currentEpisodeNumber = ep?.episodeNumber ?? null;
    }

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
      currentEpisodeNumber,
      currentLanguage: row.currentLanguage ?? null,
      hasNewEpisodes: false, // TODO: compare totalEpisodes with last checked count
    });
  }

  return { items, totalCount: items.length };
}

export async function getContinueReading(): Promise<
  Array<{
    novelId: string;
    titleJa: string;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string | null;
    lastReadAt: string;
  }>
> {
  const userId = await ensureDefaultUser();
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
        eq(subscriptions.userId, userId),
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

  return result;
}
