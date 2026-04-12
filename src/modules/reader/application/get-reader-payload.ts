import { eq, and, lt, gt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, novels, translations } from "@/lib/db/schema";
import type { ReaderPayload } from "../api/schemas";

export async function getReaderPayload(
  episodeId: string,
): Promise<ReaderPayload | null> {
  const db = getDb();

  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) return null;

  const [novel] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, episode.novelId))
    .limit(1);

  if (!novel) return null;

  // Find prev/next episodes
  const [prevEpisode] = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, episode.novelId),
        lt(episodes.episodeNumber, episode.episodeNumber),
      ),
    )
    .orderBy(episodes.episodeNumber)
    .limit(1);

  const [nextEpisode] = await db
    .select({ id: episodes.id })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, episode.novelId),
        gt(episodes.episodeNumber, episode.episodeNumber),
      ),
    )
    .orderBy(episodes.episodeNumber)
    .limit(1);

  // Check for available translation
  const [translation] = await db
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

  return {
    novel: {
      id: novel.id,
      titleJa: novel.titleJa,
      titleNormalized: novel.titleNormalized,
      sourceNcode: novel.sourceNcode,
    },
    episode: {
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      titleJa: episode.titleJa,
      sourceTextJa: episode.normalizedTextJa,
    },
    translation: translation
      ? {
          status: translation.status,
          translatedText: translation.translatedText,
          provider: translation.provider,
          modelName: translation.modelName,
        }
      : null,
    navigation: {
      prevEpisodeId: prevEpisode?.id ?? null,
      nextEpisodeId: nextEpisode?.id ?? null,
    },
    progress: null, // Will be populated when auth is implemented
  };
}
