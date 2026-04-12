import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";
import type { TranslationStatusResponse, TranslationRecord } from "../api/schemas";

export async function getTranslationStatus(
  episodeId: string,
): Promise<TranslationStatusResponse> {
  const db = getDb();

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
    provider: r.provider,
    modelName: r.modelName,
    errorMessage: r.errorMessage,
    completedAt: r.completedAt?.toISOString() ?? null,
  }));

  if (rows.length === 0) {
    return {
      episodeId,
      targetLanguage: "ko",
      status: "not_requested",
      translatedText: null,
      provider: null,
      modelName: null,
      errorMessage: null,
      completedAt: null,
      translations: [],
    };
  }

  // Pick the "active" translation: prefer in-progress, then most recent available, then most recent overall
  const inProgress = rows.find((r) => r.status === "queued" || r.status === "processing");
  const active = inProgress ?? rows[0];

  return {
    episodeId,
    targetLanguage: "ko",
    status: active.status as TranslationStatusResponse["status"],
    translatedText: active.translatedText,
    provider: active.provider,
    modelName: active.modelName,
    errorMessage: active.errorMessage,
    completedAt: active.completedAt?.toISOString() ?? null,
    translations: allRecords,
  };
}
