import { and, desc, eq, gt, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema/episodes";
import { novels } from "@/lib/db/schema/novels";
import { translations } from "@/lib/db/schema/translations";
import { logger } from "@/lib/logger";
import { extractGlossaryTerms } from "./extract-glossary";

const MAX_SAMPLE_SIZE = 20;

export interface GlossaryRefreshPayload {
  novelId: string;
  sinceEpisodeNumber?: number;
  sampleSize?: number;
}

export interface GlossaryRefreshProgress {
  stage: "sampling" | "extracting" | "completed";
  processed: number;
  total: number;
}

export interface GlossaryRefreshResult {
  episodesSampled: number;
  entriesAdded: number;
  entriesSkipped: number;
}

interface SampleRow {
  episodeId: string;
  episodeNumber: number;
  translationId: string;
}

export async function sampleRecentTranslations(
  novelId: string,
  sampleSize: number,
  sinceEpisodeNumber?: number,
): Promise<SampleRow[]> {
  const db = getDb();

  const [novel] = await db
    .select({ glossaryLastRefreshedAt: novels.glossaryLastRefreshedAt })
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);

  const filters = [
    eq(episodes.novelId, novelId),
    eq(translations.status, "available"),
    isNotNull(translations.translatedText),
  ];
  if (sinceEpisodeNumber !== undefined) {
    filters.push(gt(episodes.episodeNumber, sinceEpisodeNumber));
  } else if (novel?.glossaryLastRefreshedAt) {
    filters.push(gte(translations.completedAt, novel.glossaryLastRefreshedAt));
  }

  const rows = await db
    .select({
      episodeId: episodes.id,
      episodeNumber: episodes.episodeNumber,
      translationId: translations.id,
    })
    .from(translations)
    .innerJoin(episodes, eq(translations.episodeId, episodes.id))
    .where(and(...filters))
    .orderBy(desc(episodes.episodeNumber))
    .limit(sampleSize);

  return rows;
}

export async function refreshGlossary(
  payload: GlossaryRefreshPayload,
  onProgress?: (p: GlossaryRefreshProgress) => Promise<void> | void,
): Promise<GlossaryRefreshResult> {
  const db = getDb();
  const size = Math.min(Math.max(payload.sampleSize ?? 10, 1), MAX_SAMPLE_SIZE);

  await onProgress?.({ stage: "sampling", processed: 0, total: size });

  const sample = await sampleRecentTranslations(
    payload.novelId,
    size,
    payload.sinceEpisodeNumber,
  );

  let added = 0;
  let skipped = 0;

  for (const [index, row] of sample.entries()) {
    await onProgress?.({
      stage: "extracting",
      processed: index,
      total: sample.length,
    });
    try {
      const result = await extractGlossaryTerms({
        novelId: payload.novelId,
        episodeId: row.episodeId,
        episodeNumber: row.episodeNumber,
        translationId: row.translationId,
      });
      added += result.imported;
      skipped += result.skipped;
    } catch (err) {
      logger.warn("Glossary extraction skipped due to error", {
        novelId: payload.novelId,
        episodeId: row.episodeId,
        err: err instanceof Error ? err.message : String(err),
      });
      skipped += 1;
    }
  }

  if (added > 0) {
    await db
      .update(novels)
      .set({ glossaryLastRefreshedAt: sql`now()`, updatedAt: new Date() })
      .where(eq(novels.id, payload.novelId));
  }

  await onProgress?.({
    stage: "completed",
    processed: sample.length,
    total: sample.length,
  });

  return {
    episodesSampled: sample.length,
    entriesAdded: added,
    entriesSkipped: skipped,
  };
}
