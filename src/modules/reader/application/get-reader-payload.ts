import { eq, and, lt, gt, desc, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, novelGlossaryEntries, novels, readingProgress, translations, translationSettings } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { translateTexts } from "@/lib/translate-cache";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import { estimateTranslationProgress } from "@/modules/translation/application/estimate-translation-progress";
import type { ReaderPayload } from "../api/schemas";

export async function getReaderPayload(
  episodeId: string,
  compareModelName?: string,
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
    .orderBy(desc(episodes.episodeNumber))
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

  // TOC window: ±10 episodes around the current one.
  const TOC_RADIUS = 10;
  const tocRows = await db
    .select({
      id: episodes.id,
      episodeNumber: episodes.episodeNumber,
      titleJa: episodes.titleJa,
    })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, episode.novelId),
        gt(episodes.episodeNumber, episode.episodeNumber - TOC_RADIUS - 1),
        lt(episodes.episodeNumber, episode.episodeNumber + TOC_RADIUS + 1),
      ),
    )
    .orderBy(asc(episodes.episodeNumber));

  // Get all Korean translations for this episode
  const allTranslations = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.episodeId, episodeId),
        eq(translations.targetLanguage, "ko"),
      ),
    )
    .orderBy(desc(translations.createdAt));

  // Keep an existing readable translation visible while a newer one is processing.
  const pendingTranslation = allTranslations.find(
    (r) => r.status === "queued" || r.status === "processing",
  ) ?? null;
  const latestAvailable = allTranslations.find((r) => r.status === "available") ?? null;
  const translation = latestAvailable ?? pendingTranslation ?? allTranslations[0] ?? null;
  const pendingProgressEstimate = pendingTranslation?.status === "processing" && episode.normalizedTextJa
    ? await estimateTranslationProgress({
        modelName: pendingTranslation.modelName,
        sourceText: episode.normalizedTextJa,
        processingStartedAt: pendingTranslation.processingStartedAt,
      })
    : null;

  // Get user's configured translation model
  const userId = await resolveUserId();
  const [settings] = await db
    .select({ modelName: translationSettings.modelName })
    .from(translationSettings)
    .where(eq(translationSettings.userId, userId))
    .limit(1);

  const configuredModel = settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL;

  // Translate episode title and TOC entries via shared cache. Both
  // translatable inputs deduped into one call.
  const titleSourcesForTranslation = Array.from(
    new Set(
      [
        episode.titleJa ?? null,
        ...tocRows.map((r) => r.titleJa),
      ].filter((s): s is string => typeof s === "string" && s.trim().length > 0),
    ),
  );
  const titleCache =
    titleSourcesForTranslation.length > 0
      ? await translateTexts(titleSourcesForTranslation)
      : new Map<string, string>();
  const titleKo = episode.titleJa ? titleCache.get(episode.titleJa) ?? null : null;

  const [progressRow] = await db
    .select({
      currentEpisodeId: readingProgress.currentEpisodeId,
      currentLanguage: readingProgress.currentLanguage,
      scrollAnchor: readingProgress.scrollAnchor,
      progressPercent: readingProgress.progressPercent,
    })
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, userId),
        eq(readingProgress.novelId, novel.id),
      ),
    )
    .limit(1);

  const allGlossaryEntries = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      category: novelGlossaryEntries.category,
      notes: novelGlossaryEntries.notes,
      importance: novelGlossaryEntries.importance,
    })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novel.id),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    )
    .orderBy(desc(novelGlossaryEntries.importance), asc(novelGlossaryEntries.termJa));

  const episodeHaystack = [
    episode.normalizedTextJa ?? "",
    episode.prefaceJa ?? "",
    episode.afterwordJa ?? "",
    episode.titleJa ?? "",
  ].join("\n");
  const glossaryEntries = allGlossaryEntries.filter(
    (entry) => entry.termJa.length > 0 && episodeHaystack.includes(entry.termJa),
  );

  // Language preference is novel-wide and should persist across episodes.
  // Scroll position is episode-specific — only restore if same episode.
  const isSameEpisode = progressRow?.currentEpisodeId === episodeId;
  const progress = progressRow
    ? {
        currentLanguage: progressRow.currentLanguage,
        scrollAnchor: isSameEpisode ? progressRow.scrollAnchor : null,
        progressPercent: isSameEpisode ? progressRow.progressPercent : null,
      }
    : null;

  return {
    novel: {
      id: novel.id,
      titleJa: novel.titleJa,
      titleKo: novel.titleKo ?? null,
      titleNormalized: novel.titleNormalized,
      sourceId: novel.sourceId,
    },
    episode: {
      id: episode.id,
      episodeNumber: episode.episodeNumber,
      titleJa: episode.titleJa,
      titleKo,
      sourceTextJa: episode.normalizedTextJa,
      prefaceJa: episode.prefaceJa ?? null,
      afterwordJa: episode.afterwordJa ?? null,
    },
    translation: translation
      ? {
          status: translation.status,
          translatedText: translation.translatedText,
          translatedPreface: translation.translatedPreface ?? null,
          translatedAfterword: translation.translatedAfterword ?? null,
          provider: translation.provider,
          modelName: translation.modelName,
          errorMessage: translation.errorMessage,
          hasWarnings: Array.isArray(translation.qualityWarnings) && translation.qualityWarnings.length > 0,
        }
      : null,
    translations: allTranslations
      .filter((t) => t.status === "available")
      .map((t) => ({
        id: t.id,
        modelName: t.modelName,
        completedAt: t.completedAt?.toISOString() ?? null,
        estimatedCostUsd: t.estimatedCostUsd,
      })),
    compareTranslation: (() => {
      if (!compareModelName) return null;
      const match = allTranslations.find(
        (t) =>
          t.status === "available" &&
          t.modelName === compareModelName &&
          t.id !== translation?.id,
      );
      if (!match) return null;
      return {
        modelName: match.modelName,
        translatedText: match.translatedText,
        translatedPreface: match.translatedPreface ?? null,
        translatedAfterword: match.translatedAfterword ?? null,
      };
    })(),
    pendingTranslation: pendingTranslation
      ? {
          status: pendingTranslation.status as "queued" | "processing",
          modelName: pendingTranslation.modelName,
          progressEstimate: pendingProgressEstimate,
        }
      : null,
    configuredModel,
    navigation: {
      prevEpisodeId: prevEpisode?.id ?? null,
      nextEpisodeId: nextEpisode?.id ?? null,
      totalEpisodes: novel.totalEpisodes ?? null,
      toc: tocRows.map((r) => ({
        id: r.id,
        episodeNumber: r.episodeNumber,
        titleJa: r.titleJa,
        titleKo: r.titleJa ? titleCache.get(r.titleJa) ?? null : null,
      })),
    },
    progress,
    glossary: glossaryEntries.map((entry) => ({
      termJa: entry.termJa,
      termKo: entry.termKo,
      category: entry.category,
      notes: entry.notes,
      importance: entry.importance,
    })),
    styleGuide: null,
  };
}
