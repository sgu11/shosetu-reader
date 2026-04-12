import { NextRequest, NextResponse } from "next/server";
import { getRanking } from "@/modules/catalog/application/get-ranking";
import type { RankingPeriod } from "@/modules/source/infra/syosetu-api";
import { rateLimit } from "@/lib/rate-limit";

const VALID_PERIODS = new Set(["daily", "weekly", "monthly", "quarterly"]);

// 20 ranking requests per minute per IP
const RATE_LIMIT_CONFIG = { limit: 20, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT_CONFIG, "ranking");
  if (limited) return limited;
  try {
    const { searchParams } = req.nextUrl;
    const period = searchParams.get("period") ?? "daily";
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json(
        { error: "Invalid period. Use: daily, weekly, monthly, quarterly" },
        { status: 400 },
      );
    }

    const items = await getRanking(period as RankingPeriod, limit);
    return NextResponse.json({ items, period });
  } catch (err) {
    console.error("Failed to fetch ranking:", err);
    return NextResponse.json({ error: "Failed to fetch ranking" }, { status: 500 });
  }
}
