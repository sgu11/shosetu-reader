import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes, translations } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { OpenRouterProvider } from "../infra/openrouter-provider";

const PROMPT_VERSION = "v1";

/**
 * Request a Korean translation for an episode.
 * If a translation already exists with the same identity, returns it.
 * Otherwise, creates a queued row and immediately processes it (synchronous for now).
 */
export async function requestTranslation(
  episodeId: string,
): Promise<{ translationId: string; status: string }> {
  const db = getDb();

  // Fetch episode
  const [episode] = await db
    .select()
    .from(episodes)
    .where(eq(episodes.id, episodeId))
    .limit(1);

  if (!episode) {
    throw new Error("Episode not found");
  }

  if (!episode.normalizedTextJa) {
    throw new Error("Episode has no source text to translate");
  }

  const sourceChecksum = episode.rawHtmlChecksum ?? "unknown";

  const provider = new OpenRouterProvider(env.OPENROUTER_API_KEY ?? "");

  // Check for existing translation with same identity
  const [existing] = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.episodeId, episodeId),
        eq(translations.targetLanguage, "ko"),
        eq(translations.provider, provider.provider),
        eq(translations.modelName, provider.modelName),
        eq(translations.promptVersion, PROMPT_VERSION),
        eq(translations.sourceChecksum, sourceChecksum),
      ),
    )
    .limit(1);

  if (existing) {
    return { translationId: existing.id, status: existing.status };
  }

  // Insert queued row
  const [row] = await db
    .insert(translations)
    .values({
      episodeId,
      targetLanguage: "ko",
      provider: provider.provider,
      modelName: provider.modelName,
      promptVersion: PROMPT_VERSION,
      sourceChecksum,
      status: "queued",
    })
    .returning({ id: translations.id });

  // Process immediately (will be async via job queue later)
  processTranslation(row.id, episode.normalizedTextJa, provider).catch(
    () => {
      // Error is persisted in the translation row
    },
  );

  return { translationId: row.id, status: "queued" };
}

async function processTranslation(
  translationId: string,
  sourceText: string,
  provider: OpenRouterProvider,
): Promise<void> {
  const db = getDb();

  // Mark as processing
  await db
    .update(translations)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(translations.id, translationId));

  try {
    const result = await provider.translate({
      sourceText,
      sourceLanguage: "ja",
      targetLanguage: "ko",
    });

    await db
      .update(translations)
      .set({
        status: "available",
        translatedText: result.translatedText,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(translations.id, translationId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await db
      .update(translations)
      .set({
        status: "failed",
        errorCode: "TRANSLATION_ERROR",
        errorMessage: message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(translations.id, translationId));
  }
}
