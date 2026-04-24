import { NextResponse } from "next/server";
import { getTranslationStatus } from "@/modules/translation/application/get-translation-status";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";

interface Ctx {
  params: Promise<{ episodeId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { episodeId } = await ctx.params;
    if (!isValidUuid(episodeId)) {
      return NextResponse.json({ error: "Invalid episode ID" }, { status: 400 });
    }
    const status = await getTranslationStatus(episodeId);
    return NextResponse.json(status);
  } catch (err) {
    logger.error("Failed to get translation status", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/translations/episodes/:episodeId/status",
    });
    return NextResponse.json({ error: "Failed to get translation status" }, { status: 500 });
  }
}
