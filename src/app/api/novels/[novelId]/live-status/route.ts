import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";
import { getNovelLiveStatus } from "@/modules/catalog/application/get-novel-live-status";

interface Ctx {
  params: Promise<{ novelId: string }>;
}

const RATE_LIMIT = { limit: 60, windowSeconds: 60 } as const;

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const limited = await rateLimit(req, RATE_LIMIT, "novel-live-status");
    if (limited) return limited;

    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }

    const status = await getNovelLiveStatus(novelId);
    return NextResponse.json(status, {
      headers: {
        // Short SWR keeps polling tabs from re-running the heavy CTE
        // every 5s while still staying responsive to job progress.
        "Cache-Control": "private, max-age=2, stale-while-revalidate=8",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch live status" }, { status: 500 });
  }
}
