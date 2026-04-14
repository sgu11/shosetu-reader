import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { acquireRequestDeduplicationLock } from "@/lib/request-dedupe";
import { episodes } from "@/lib/db/schema";
import { requestTranslation } from "@/modules/translation/application/request-translation";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

// 2 bulk-translate requests per minute per IP
const RATE_LIMIT = { limit: 2, windowSeconds: 60 };

/**
 * POST /api/novels/:novelId/bulk-translate?limit=10
 *
 * Finds the next N fetched episodes without an available/in-progress
 * Korean translation and fires off translation requests for each.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "bulk-translate");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "10", 10) || 10, 1), 50);

  const dedupe = await acquireRequestDeduplicationLock({
    scope: `bulk-translate:${novelId}:${limit}`,
    ttlMs: 10_000,
  });
  if (!dedupe.acquired) {
    return NextResponse.json({ error: "Bulk translation was requested recently" }, { status: 409 });
  }

  const db = getDb();

  // Find fetched episodes that have no available/queued/processing Korean translation
  const fetched = await db
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
    .orderBy(episodes.episodeNumber)
    .limit(limit);

  if (fetched.length === 0) {
    return NextResponse.json({ queued: 0, message: "No untranslated episodes found" });
  }

  // Fire off translations (they process in background)
  let queued = 0;
  let failed = 0;

  for (const ep of fetched) {
    try {
      await requestTranslation(ep.id);
      queued++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ queued, failed, total: fetched.length }, { status: 202 });
}
