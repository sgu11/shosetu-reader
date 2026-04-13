import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, episodes } from "@/lib/db/schema";
import {
  fetchEpisodeList,
  fetchEpisodeContent,
} from "@/modules/source/infra/episode-scraper";

const FETCH_DELAY_MS = 1000; // Rate limit: 1 request per second

/**
 * Discover episodes from the novel's TOC and insert new episode records.
 * Does NOT fetch content — just creates pending episode rows.
 */
export async function discoverEpisodes(novelId: string): Promise<number> {
  const db = getDb();

  const [novel] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);

  if (!novel) throw new Error(`Novel not found: ${novelId}`);

  const tocEntries = await fetchEpisodeList(novel.sourceNcode);
  let newCount = 0;

  for (const entry of tocEntries) {
    // Check if episode already exists
    const existing = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.novelId, novelId),
          eq(episodes.sourceEpisodeId, String(entry.episodeNumber)),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(episodes).values({
      novelId,
      sourceEpisodeId: String(entry.episodeNumber),
      episodeNumber: entry.episodeNumber,
      titleJa: entry.title,
      sourceUrl: entry.sourceUrl,
      fetchStatus: "pending",
    });
    newCount++;
  }

  return newCount;
}

/**
 * Fetch content for a single episode and update its record.
 */
export async function fetchAndPersistEpisode(episodeId: string): Promise<void> {
  const db = getDb();

  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) throw new Error(`Episode not found: ${episodeId}`);

  const [novel] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, episode.novelId))
    .limit(1);

  if (!novel) throw new Error(`Novel not found for episode: ${episodeId}`);

  // Mark as fetching
  await db
    .update(episodes)
    .set({ fetchStatus: "fetching", updatedAt: new Date() })
    .where(eq(episodes.id, episodeId));

  try {
    const content = await fetchEpisodeContent(
      novel.sourceNcode,
      episode.episodeNumber,
    );

    await db
      .update(episodes)
      .set({
        titleJa: content.title || episode.titleJa,
        rawHtmlChecksum: content.checksum,
        rawTextJa: content.normalizedText,
        normalizedTextJa: content.normalizedText,
        prefaceJa: content.prefaceText,
        afterwordJa: content.afterwordText,
        fetchStatus: "fetched",
        lastFetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(episodes.id, episodeId));
  } catch (err) {
    await db
      .update(episodes)
      .set({ fetchStatus: "failed", updatedAt: new Date() })
      .where(eq(episodes.id, episodeId));
    throw err;
  }
}

/**
 * Fetch content for the first N pending episodes of a novel.
 * Respects rate limiting with delays between requests.
 */
export async function fetchPendingEpisodes(
  novelId: string,
  limit: number = 5,
  onProgress?: (progress: {
    processed: number;
    total: number;
    fetched: number;
    failed: number;
    currentEpisodeId: string;
  }) => Promise<void> | void,
): Promise<{ fetched: number; failed: number; total: number }> {
  const db = getDb();

  const pending = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(eq(episodes.novelId, novelId), eq(episodes.fetchStatus, "pending")),
    )
    .orderBy(episodes.episodeNumber)
    .limit(limit);

  let fetched = 0;
  let failed = 0;
  const total = pending.length;

  for (const [index, ep] of pending.entries()) {
    try {
      await fetchAndPersistEpisode(ep.id);
      fetched++;
    } catch {
      failed++;
    }

    await onProgress?.({
      processed: index + 1,
      total,
      fetched,
      failed,
      currentEpisodeId: ep.id,
    });

    // Rate limit between fetches
    if (index < pending.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
    }
  }

  return { fetched, failed, total };
}
