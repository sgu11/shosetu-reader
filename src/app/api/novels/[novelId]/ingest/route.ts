import { NextRequest, NextResponse } from "next/server";
import { getNovelById } from "@/modules/catalog/application/get-novel";
import {
  discoverEpisodes,
  fetchPendingEpisodes,
} from "@/modules/catalog/application/ingest-episodes";

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
  const { novelId } = await params;

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
    console.error("Ingestion failed:", err);
    return NextResponse.json(
      { error: "Episode ingestion failed" },
      { status: 500 },
    );
  }
}
