import { NextRequest, NextResponse } from "next/server";
import { getNovelById } from "@/modules/catalog/application/get-novel";
import {
  discoverEpisodes,
  fetchPendingEpisodes,
} from "@/modules/catalog/application/ingest-episodes";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";

// 3 ingestion requests per minute per IP
const RATE_LIMIT = { limit: 3, windowSeconds: 60 };

/**
 * POST /api/novels/:novelId/ingest
 *
 * Discovers episodes from the novel's TOC, then fetches content for
 * the first batch of pending episodes. Accepts an optional `limit`
 * query parameter (default 5, max 20).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "ingest");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const novel = await getNovelById(novelId);
  if (!novel) {
    return NextResponse.json({ error: "Novel not found" }, { status: 404 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "5", 10) || 5, 1), 20);

  try {
    const discovered = await discoverEpisodes(novelId);
    const { fetched, failed } = await fetchPendingEpisodes(novelId, limit);

    return NextResponse.json({
      novelId,
      discovered,
      fetched,
      failed,
    });
  } catch (err) {
    logger.error("Episode ingestion failed", {
      err: err instanceof Error ? err.message : String(err),
      route: "POST /api/novels/:novelId/ingest",
    });
    return NextResponse.json(
      { error: "Episode ingestion failed" },
      { status: 500 },
    );
  }
}
