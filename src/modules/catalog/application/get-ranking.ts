import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels } from "@/lib/db/schema";
import {
  fetchRanking,
  type RankingPeriod,
  type SyosetuNovelMetadata,
} from "@/modules/source/infra/syosetu-api";
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
  const ranked = await fetchRanking(period, limit);
  const db = getDb();

  const items: RankingItem[] = [];

  for (let i = 0; i < ranked.length; i++) {
    const meta = ranked[i];

    // Check if this novel is already registered
    const [existing] = await db
      .select({ id: novels.id })
      .from(novels)
      .where(eq(novels.sourceNcode, meta.ncode))
      .limit(1);

    items.push({
      rank: i + 1,
      ncode: meta.ncode,
      title: meta.title,
      authorName: meta.authorName,
      totalEpisodes: meta.totalEpisodes,
      isCompleted: meta.isCompleted,
      sourceUrl: buildNovelUrl(meta.ncode),
      novelId: existing?.id ?? null,
    });
  }

  return items;
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
    .where(eq(novels.sourceNcode, meta.ncode))
    .limit(1);

  if (existing) return existing.id;

  const [row] = await db
    .insert(novels)
    .values({
      sourceSite: "syosetu",
      sourceNcode: meta.ncode,
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
