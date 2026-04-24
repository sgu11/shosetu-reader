import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { translateTexts } from "@/lib/translate-cache";

const RATE_LIMIT_CONFIG = { limit: 10, windowSeconds: 60 };
const MAX_TITLES = 50;

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, RATE_LIMIT_CONFIG, "ranking-translate");
  if (limited) return limited;

  try {
    const body = await req.json();
    const titles: string[] = body.titles;

    if (!Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json({ error: "titles array required" }, { status: 400 });
    }

    if (titles.length > MAX_TITLES) {
      return NextResponse.json({ error: `Max ${MAX_TITLES} titles` }, { status: 400 });
    }

    const cache = await translateTexts(titles);
    const result = titles.map((t) => cache.get(t) ?? t);

    return NextResponse.json({ translations: result });
  } catch (err) {
    logger.error("Title translation error", {
      err: err instanceof Error ? err.message : String(err),
      route: "POST /api/ranking/translate-titles",
    });
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
