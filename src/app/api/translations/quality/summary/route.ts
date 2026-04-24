import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getWarningSummary } from "@/modules/translation/application/quality-warnings-aggregation";

export async function GET(req: NextRequest) {
  try {
    const novelId = req.nextUrl.searchParams.get("novelId") ?? undefined;
    const sinceRaw = req.nextUrl.searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : undefined;
    if (since && Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "invalid since" }, { status: 400 });
    }

    const summary = await getWarningSummary({ novelId, since });
    return NextResponse.json(summary);
  } catch (err) {
    logger.error("quality summary failed", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/translations/quality/summary",
    });
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
}
