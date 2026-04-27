import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels } from "@/lib/db/schema";
import { getAdapter } from "@/modules/source/infra/registry";
import type { NovelMetadata, RankingPeriod } from "@/modules/source/domain/source-adapter";
import type { SyosetuNovelMetadata } from "@/modules/source/infra/syosetu-api";
import { buildNovelUrl } from "@/modules/source/domain/ncode";

export interface RankingItem {
  rank: number;
  ncode: string;
  title: string;
  authorName: string;
  totalEpisodes: number;
  isCompleted: boolean;
  sourceUrl: string;
  /** null if not yet registered in our DB */
  novelId: string | null;
}

/**
 * Fetch ranked novels from Syosetu and cross-reference with local DB.
 * Novels that are already registered will have a non-null novelId.
 */
export async function getRanking(
  period: RankingPeriod = "daily",
  limit: number = 20,
): Promise<RankingItem[]> {
  const adapter = getAdapter("syosetu");
  const ranked: NovelMetadata[] = await adapter.fetchRanking(period, limit);
  const db = getDb();
  const ncodes = [...new Set(ranked.map((item) => item.id))];

  const existingRows = ncodes.length === 0
    ? []
    : await db
      .select({
        id: novels.id,
        sourceId: novels.sourceId,
      })
      .from(novels)
      .where(inArray(novels.sourceId, ncodes));

  const existingByNcode = new Map(existingRows.map((row) => [row.sourceId, row.id]));

  return ranked.map((meta, index) => ({
    rank: index + 1,
    ncode: meta.id,
    title: meta.title,
    authorName: meta.authorName,
    totalEpisodes: meta.totalEpisodes ?? 0,
    isCompleted: meta.isCompleted ?? false,
    sourceUrl: buildNovelUrl(meta.id),
    novelId: existingByNcode.get(meta.id) ?? null,
  }));
}

/**
 * Register a novel from ranking metadata, upserting into DB.
 */
export async function registerFromRanking(
  ncode: string,
  meta: SyosetuNovelMetadata,
): Promise<string> {
  const db = getDb();

  const [existing] = await db
    .select({ id: novels.id })
    .from(novels)
    .where(eq(novels.sourceId, meta.ncode))
    .limit(1);

  if (existing) return existing.id;

  const [row] = await db
    .insert(novels)
    .values({
      sourceSite: "syosetu",
      sourceId: meta.ncode,
      sourceUrl: buildNovelUrl(meta.ncode),
      titleJa: meta.title,
      authorName: meta.authorName,
      summaryJa: meta.summary,
      isCompleted: meta.isCompleted,
      totalEpisodes: meta.totalEpisodes,
      sourceMetadataJson: meta.raw,
      lastSourceSyncAt: new Date(),
    })
    .returning({ id: novels.id });

  return row.id;
}
