import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novels } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { getAdapter } from "@/modules/source/infra/registry";
import type {
  NovelMetadata,
  SourceSite,
} from "@/modules/source/domain/source-adapter";
import { translateNovelMetadata } from "./translate-novel-metadata";

export interface RegisterNovelResult {
  novel: {
    id: string;
    sourceId: string;
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
 * Register a novel by site + canonical id: fetch metadata via the source
 * adapter, upsert into DB.
 */
export async function registerNovel(
  id: string,
  site: SourceSite = "syosetu",
): Promise<RegisterNovelResult> {
  const adapter = getAdapter(site);
  const metadata = await adapter.fetchNovelMetadata(id);
  return upsertNovel(site, metadata);
}

async function upsertNovel(
  site: SourceSite,
  metadata: NovelMetadata,
): Promise<RegisterNovelResult> {
  const db = getDb();
  const adapter = getAdapter(site);
  const sourceUrl = adapter.buildNovelUrl(metadata.id);

  // Check if already exists
  const existing = await db
    .select()
    .from(novels)
    .where(and(eq(novels.sourceSite, site), eq(novels.sourceId, metadata.id)))
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
        sourceMetadataJson: metadata.raw as never,
        lastSourceSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(novels.sourceSite, site), eq(novels.sourceId, metadata.id)))
      .returning();

    // Fire-and-forget: translate title/summary if not yet translated
    translateNovelMetadata(updated.id).catch((err) => {
      logger.warn("Title translation enqueue failed (non-fatal)", {
        novelId: updated.id,
        err: err instanceof Error ? err.message : String(err),
      });
    });

    return {
      novel: {
        id: updated.id,
        sourceId: updated.sourceId,
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
      sourceSite: site,
      sourceId: metadata.id,
      sourceUrl,
      titleJa: metadata.title,
      authorName: metadata.authorName,
      summaryJa: metadata.summary,
      isCompleted: metadata.isCompleted,
      totalEpisodes: metadata.totalEpisodes,
      sourceMetadataJson: metadata.raw as never,
      lastSourceSyncAt: new Date(),
    })
    .returning();

  // Fire-and-forget: translate title/summary to Korean
  translateNovelMetadata(inserted.id).catch((err) => {
    logger.warn("Metadata translation enqueue failed (non-fatal)", {
      novelId: inserted.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return {
    novel: {
      id: inserted.id,
      sourceId: inserted.sourceId,
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
