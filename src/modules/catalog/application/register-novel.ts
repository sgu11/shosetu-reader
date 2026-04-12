import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels } from "@/lib/db/schema";
import { buildNovelUrl } from "@/modules/source/domain/ncode";
import {
  fetchNovelMetadata,
  type SyosetuNovelMetadata,
} from "@/modules/source/infra/syosetu-api";
import { translateNovelMetadata } from "./translate-novel-metadata";

export interface RegisterNovelResult {
  novel: {
    id: string;
    sourceNcode: string;
    sourceUrl: string;
    titleJa: string;
    authorName: string | null;
    summaryJa: string | null;
    isCompleted: boolean | null;
    totalEpisodes: number | null;
  };
  isNew: boolean;
}

/**
 * Register a novel by ncode: fetch metadata from Syosetu, upsert into DB.
 */
export async function registerNovel(
  ncode: string,
): Promise<RegisterNovelResult> {
  const metadata = await fetchNovelMetadata(ncode);
  return upsertNovel(metadata);
}

async function upsertNovel(
  metadata: SyosetuNovelMetadata,
): Promise<RegisterNovelResult> {
  const db = getDb();
  const sourceUrl = buildNovelUrl(metadata.ncode);

  // Check if already exists
  const existing = await db
    .select()
    .from(novels)
    .where(eq(novels.sourceNcode, metadata.ncode))
    .limit(1);

  if (existing.length > 0) {
    // Update metadata on re-registration
    const [updated] = await db
      .update(novels)
      .set({
        titleJa: metadata.title,
        authorName: metadata.authorName,
        summaryJa: metadata.summary,
        isCompleted: metadata.isCompleted,
        totalEpisodes: metadata.totalEpisodes,
        sourceMetadataJson: metadata.raw,
        lastSourceSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(novels.sourceNcode, metadata.ncode))
      .returning();

    // Fire-and-forget: translate title/summary if not yet translated
    translateNovelMetadata(updated.id).catch(() => {});

    return {
      novel: {
        id: updated.id,
        sourceNcode: updated.sourceNcode,
        sourceUrl: updated.sourceUrl,
        titleJa: updated.titleJa,
        authorName: updated.authorName,
        summaryJa: updated.summaryJa,
        isCompleted: updated.isCompleted,
        totalEpisodes: updated.totalEpisodes,
      },
      isNew: false,
    };
  }

  // Insert new
  const [inserted] = await db
    .insert(novels)
    .values({
      sourceNcode: metadata.ncode,
      sourceUrl,
      titleJa: metadata.title,
      authorName: metadata.authorName,
      summaryJa: metadata.summary,
      isCompleted: metadata.isCompleted,
      totalEpisodes: metadata.totalEpisodes,
      sourceMetadataJson: metadata.raw,
      lastSourceSyncAt: new Date(),
    })
    .returning();

  // Fire-and-forget: translate title/summary to Korean
  translateNovelMetadata(inserted.id).catch(() => {});

  return {
    novel: {
      id: inserted.id,
      sourceNcode: inserted.sourceNcode,
      sourceUrl: inserted.sourceUrl,
      titleJa: inserted.titleJa,
      authorName: inserted.authorName,
      summaryJa: inserted.summaryJa,
      isCompleted: inserted.isCompleted,
      totalEpisodes: inserted.totalEpisodes,
    },
    isNew: true,
  };
}
