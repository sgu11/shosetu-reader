import { NextRequest, NextResponse } from "next/server";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import {
  getReadingStats,
  type Range,
} from "@/modules/library/application/get-reading-stats";
import { logger } from "@/lib/logger";

const ALLOWED_RANGE: Range[] = ["30d", "90d", "all"];

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("range") ?? "90d";
    const range = (ALLOWED_RANGE as string[]).includes(raw)
      ? (raw as Range)
      : "90d";

    const userId = await resolveUserId();
    const stats = await getReadingStats(userId, range);
    return NextResponse.json(stats);
  } catch (err) {
    logger.error("stats failed", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/stats",
    });
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
