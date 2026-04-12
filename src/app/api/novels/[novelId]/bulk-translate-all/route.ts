import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema";
import { requestTranslation } from "@/modules/translation/application/request-translation";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

// 1 bulk-translate-all request per minute per IP
const RATE_LIMIT = { limit: 1, windowSeconds: 60 };

/**
 * POST /api/novels/:novelId/bulk-translate-all
 *
 * Discovers all fetched episodes without a Korean translation
 * and fires off translation requests in the background.
 * Returns immediately with 202.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = rateLimit(request, RATE_LIMIT, "bulk-translate-all");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const db = getDb();

  // Count all fetched episodes without available/queued/processing Korean translation
  const untranslated = await db
    .select({ id: episodes.id, episodeNumber: episodes.episodeNumber })
    .from(episodes)
    .where(
      and(
        eq(episodes.novelId, novelId),
        eq(episodes.fetchStatus, "fetched"),
        sql`NOT EXISTS (
          SELECT 1 FROM translations t
          WHERE t.episode_id = ${episodes.id}
            AND t.target_language = 'ko'
            AND t.status IN ('available', 'queued', 'processing')
        )`,
      ),
    )
    .orderBy(episodes.episodeNumber);

  if (untranslated.length === 0) {
    return NextResponse.json({ queued: 0, message: "No untranslated episodes found" });
  }

  const total = untranslated.length;

  // Fire off all translations in background (fire-and-forget)
  (async () => {
    let queued = 0;
    let failed = 0;
    for (const ep of untranslated) {
      try {
        await requestTranslation(ep.id);
        queued++;
      } catch {
        failed++;
      }
    }
    console.log(`Bulk-translate-all for ${novelId}: ${queued} queued, ${failed} failed out of ${total}`);
  })().catch((err) => {
    console.error(`Background bulk-translate-all failed for ${novelId}:`, err);
  });

  return NextResponse.json(
    { novelId, total, message: "Translating all untranslated episodes in background" },
    { status: 202 },
  );
}
