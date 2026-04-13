import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations } from "@/lib/db/schema";
import { estimateTranslationProgress } from "./estimate-translation-progress";
import type { TranslationStatusResponse, TranslationRecord } from "../api/schemas";

export async function getTranslationStatus(
  episodeId: string,
): Promise<TranslationStatusResponse> {
  const db = getDb();
  const [episode] = await db
    .select({
      sourceTextJa: episodes.normalizedTextJa,
    })
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  // Get all Korean translations for this episode
  const rows = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.episodeId, episodeId),
        eq(translations.targetLanguage, "ko"),
      ),
    )
    .orderBy(desc(translations.createdAt));

  const allRecords: TranslationRecord[] = rows.map((r) => ({
    id: r.id,
    status: r.status as TranslationRecord["status"],
    translatedText: r.translatedText,
    translatedPreface: r.translatedPreface ?? null,
    translatedAfterword: r.translatedAfterword ?? null,
    provider: r.provider,
    modelName: r.modelName,
    errorMessage: r.errorMessage,
    completedAt: r.completedAt?.toISOString() ?? null,
    estimatedCostUsd: r.estimatedCostUsd,
  }));

  if (rows.length === 0) {
    return {
      episodeId,
      targetLanguage: "ko",
      status: "not_requested",
      translatedText: null,
      translatedPreface: null,
      translatedAfterword: null,
      provider: null,
      modelName: null,
      errorMessage: null,
      completedAt: null,
      pendingTranslation: null,
      translations: [],
    };
  }

  // Keep the most recent readable translation visible while a newer request is still running.
  const inProgress = rows.find((r) => r.status === "queued" || r.status === "processing");
  const latestAvailable = rows.find((r) => r.status === "available");
  const active = latestAvailable ?? inProgress ?? rows[0];
  const progressEstimate = inProgress?.status === "processing" && episode?.sourceTextJa
    ? await estimateTranslationProgress({
        modelName: inProgress.modelName,
        sourceText: episode.sourceTextJa,
        processingStartedAt: inProgress.processingStartedAt,
      })
    : null;

  return {
    episodeId,
    targetLanguage: "ko",
    status: active.status as TranslationStatusResponse["status"],
    translatedText: active.translatedText,
    translatedPreface: active.translatedPreface ?? null,
    translatedAfterword: active.translatedAfterword ?? null,
    provider: active.provider,
    modelName: active.modelName,
    errorMessage: active.errorMessage,
    completedAt: active.completedAt?.toISOString() ?? null,
    pendingTranslation: inProgress
      ? {
          status: inProgress.status as "queued" | "processing",
          modelName: inProgress.modelName,
          progressEstimate,
        }
      : null,
    translations: allRecords,
  };
}
