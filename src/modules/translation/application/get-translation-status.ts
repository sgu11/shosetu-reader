import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";
import type { TranslationStatusResponse } from "../api/schemas";

export async function getTranslationStatus(
  episodeId: string,
): Promise<TranslationStatusResponse> {
  const db = getDb();

  // Get the most recent Korean translation for this episode
  const [row] = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.episodeId, episodeId),
        eq(translations.targetLanguage, "ko"),
      ),
    )
    .orderBy(translations.createdAt)
    .limit(1);

  if (!row) {
    return {
      episodeId,
      targetLanguage: "ko",
      status: "not_requested",
      translatedText: null,
      provider: null,
      modelName: null,
      completedAt: null,
    };
  }

  return {
    episodeId,
    targetLanguage: "ko",
    status: row.status as TranslationStatusResponse["status"],
    translatedText: row.translatedText,
    provider: row.provider,
    modelName: row.modelName,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
