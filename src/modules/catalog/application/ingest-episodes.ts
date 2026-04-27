import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels, episodes } from "@/lib/db/schema";
import { getAdapter } from "@/modules/source/infra/registry";
import type { SourceSite } from "@/modules/source/domain/source-adapter";

// Rate limiting is owned by the adapter registry's per-host token bucket
// (see RateLimitedAdapter in registry.ts). The decorator serializes outbound
// fetches across all callers (api routes + worker), so per-call setTimeout
// is no longer required for politeness.

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

  const adapter = getAdapter(novel.sourceSite as SourceSite);
  const tocEntries = await adapter.fetchEpisodeList(novel.sourceId);
  if (tocEntries.length === 0) return 0;

  const sourceIds = tocEntries.map((e) => e.sourceEpisodeId);
  const existingRows = await db
    .select({ sourceEpisodeId: episodes.sourceEpisodeId })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, novelId),
        inArray(episodes.sourceEpisodeId, sourceIds),
      ),
    );
  const existingSet = new Set(existingRows.map((r) => r.sourceEpisodeId));

  const toInsert = tocEntries
    .filter((entry) => !existingSet.has(entry.sourceEpisodeId))
    .map((entry) => ({
      novelId,
      sourceEpisodeId: entry.sourceEpisodeId,
      episodeNumber: entry.episodeNumber,
      titleJa: entry.title,
      sourceUrl: entry.sourceUrl,
      fetchStatus: "pending" as const,
    }));

  if (toInsert.length > 0) {
    await db.insert(episodes).values(toInsert).onConflictDoNothing({
      target: [episodes.novelId, episodes.sourceEpisodeId],
    });
  }

  return toInsert.length;
}

/**
 * Reset all fetched (or failed) episodes of a novel back to "pending"
 * so they will be re-fetched on the next ingest run.
 * Returns the number of episodes reset.
 */
export async function resetFetchedEpisodes(novelId: string): Promise<number> {
  const db = getDb();

  const result = await db
    .update(episodes)
    .set({ fetchStatus: "pending", updatedAt: new Date() })
    .where(
      and(
        eq(episodes.novelId, novelId),
        sql`${episodes.fetchStatus} IN ('fetched', 'failed')`,
      ),
    )
    .returning({ id: episodes.id });

  return result.length;
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

  const adapter = getAdapter(novel.sourceSite as SourceSite);

  // Mark as fetching
  await db
    .update(episodes)
    .set({ fetchStatus: "fetching", updatedAt: new Date() })
    .where(eq(episodes.id, episodeId));

  try {
    const content = await adapter.fetchEpisodeContent(novel.sourceId, {
      episodeNumber: episode.episodeNumber,
      sourceEpisodeId: episode.sourceEpisodeId,
    });

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
 * Fetch content and reconcile against the stored checksum. If unchanged,
 * only lastFetchedAt is bumped; otherwise the episode row is rewritten.
 * Caller may observe translation drift for "updated" episodes — translations
 * still point to the old source text until re-requested.
 */
export interface ReconcileResult {
  status: "unchanged" | "updated" | "failed";
  previousChecksum: string | null;
  newChecksum: string | null;
}

export async function fetchAndReconcileEpisode(
  episodeId: string,
): Promise<ReconcileResult> {
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

  const adapter = getAdapter(novel.sourceSite as SourceSite);

  try {
    const content = await adapter.fetchEpisodeContent(novel.sourceId, {
      episodeNumber: episode.episodeNumber,
      sourceEpisodeId: episode.sourceEpisodeId,
    });

    const now = new Date();
    if (content.checksum === episode.rawHtmlChecksum) {
      await db
        .update(episodes)
        .set({ lastFetchedAt: now, updatedAt: now })
        .where(eq(episodes.id, episodeId));
      return {
        status: "unchanged",
        previousChecksum: episode.rawHtmlChecksum,
        newChecksum: content.checksum,
      };
    }

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
        lastFetchedAt: now,
        updatedAt: now,
      })
      .where(eq(episodes.id, episodeId));

    return {
      status: "updated",
      previousChecksum: episode.rawHtmlChecksum,
      newChecksum: content.checksum,
    };
  } catch {
    return {
      status: "failed",
      previousChecksum: episode.rawHtmlChecksum,
      newChecksum: null,
    };
  }
}

/**
 * Iterate every fetched episode of a novel, comparing each source checksum
 * against its stored value. Skips DB writes for unchanged episodes.
 */
export async function reingestNovelByChecksum(
  novelId: string,
  onProgress?: (progress: {
    processed: number;
    total: number;
    unchanged: number;
    updated: number;
    failed: number;
    currentEpisodeId: string;
  }) => Promise<void> | void,
): Promise<{ unchanged: number; updated: number; failed: number; total: number }> {
  const db = getDb();

  const rows = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(eq(episodes.novelId, novelId), eq(episodes.fetchStatus, "fetched")),
    )
    .orderBy(episodes.episodeNumber);

  let unchanged = 0;
  let updated = 0;
  let failed = 0;
  const total = rows.length;

  for (const [index, ep] of rows.entries()) {
    const result = await fetchAndReconcileEpisode(ep.id);
    if (result.status === "unchanged") unchanged += 1;
    else if (result.status === "updated") updated += 1;
    else failed += 1;

    await onProgress?.({
      processed: index + 1,
      total,
      unchanged,
      updated,
      failed,
      currentEpisodeId: ep.id,
    });

    // Rate limit handled by adapter registry's per-host token bucket.
  }

  return { unchanged, updated, failed, total };
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

    // Rate limit handled by adapter registry's per-host token bucket.
  }

  return { fetched, failed, total };
}
