import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { acquireRequestDeduplicationLock } from "@/lib/request-dedupe";
import { episodes, translationSessions, translationSettings } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import { createTranslationSession } from "@/modules/translation/application/translation-sessions";
import { env } from "@/lib/env";

// 1 bulk-retranslate request per minute per IP
const RATE_LIMIT = { limit: 1, windowSeconds: 60 };

/**
 * POST /api/novels/:novelId/bulk-retranslate
 *
 * Finds all fetched episodes that have at least one available Korean
 * translation (from any model) and creates a translation session that
 * re-translates them with the user's currently configured model.
 * Episodes already translated with the current model are skipped
 * by the unique index on (episodeId, targetLanguage, provider, modelName,
 * promptVersion, sourceChecksum).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "bulk-retranslate");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const db = getDb();
  const userId = await resolveUserId();

  // Load user's current model
  const [settings] = await db
    .select({ modelName: translationSettings.modelName })
    .from(translationSettings)
    .where(eq(translationSettings.userId, userId))
    .limit(1);

  const targetModel = settings?.modelName ?? env.OPENROUTER_DEFAULT_MODEL;

  // Find all fetched episodes that have any available Korean translation
  // (regardless of model) — these are candidates for re-translation.
  // Episodes already translated with the current model will be skipped
  // by the unique index during insert.
  const retranslatable = await db
    .select({ id: episodes.id, episodeNumber: episodes.episodeNumber })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, novelId),
        eq(episodes.fetchStatus, "fetched"),
        sql`EXISTS (
          SELECT 1 FROM translations t
          WHERE t.episode_id = ${episodes.id}
            AND t.target_language = 'ko'
            AND t.status = 'available'
        )`,
      ),
    )
    .orderBy(episodes.episodeNumber);

  if (retranslatable.length === 0) {
    return NextResponse.json({ queued: 0, message: "No translated episodes found to re-translate" });
  }

  const dedupe = await acquireRequestDeduplicationLock({
    scope: `bulk-retranslate:${novelId}`,
    ttlMs: 10_000,
  });
  if (!dedupe.acquired) {
    return NextResponse.json({ error: "Re-translation was requested recently" }, { status: 409 });
  }

  // Prevent duplicate sessions — return existing active session if one exists
  const [existingSession] = await db
    .select({ id: translationSessions.id })
    .from(translationSessions)
    .where(
      and(
        eq(translationSessions.novelId, novelId),
        eq(translationSessions.status, "active"),
      ),
    )
    .limit(1);

  if (existingSession) {
    return NextResponse.json(
      {
        novelId,
        total: retranslatable.length,
        targetModel,
        sessionId: existingSession.id,
        message: "Active session already exists — reusing it",
      },
      { status: 200 },
    );
  }

  const total = retranslatable.length;
  const episodeIds = retranslatable.map((episode) => episode.id);

  const { sessionId } = await createTranslationSession(novelId, episodeIds, targetModel);

  return NextResponse.json(
    {
      novelId,
      total,
      targetModel,
      sessionId,
      message: `Re-translating ${total} episodes with ${targetModel}`,
    },
    { status: 202 },
  );
}
