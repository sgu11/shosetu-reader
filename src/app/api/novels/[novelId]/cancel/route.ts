import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { cancelNovelWork } from "@/modules/jobs/application/cancel-novel-work";

const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "novel-cancel");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  try {
    const result = await cancelNovelWork(novelId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("Failed to cancel novel work", {
      novelId,
      err: err instanceof Error ? err.message : String(err),
      route: "POST /api/novels/[novelId]/cancel",
    });
    return NextResponse.json(
      { error: "Failed to cancel" },
      { status: 500 },
    );
  }
}
