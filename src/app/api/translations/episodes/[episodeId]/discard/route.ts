import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";
import { discardEpisodeTranslationInputSchema } from "@/modules/translation/api/schemas";
import { discardEpisodeTranslations } from "@/modules/translation/application/discard-translations";

interface Ctx {
  params: Promise<{ episodeId: string }>;
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { episodeId } = await ctx.params;
    if (!isValidUuid(episodeId)) {
      return NextResponse.json({ error: "Invalid episode ID" }, { status: 400 });
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Allow empty body for future defaults.
    }

    const parsed = discardEpisodeTranslationInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await discardEpisodeTranslations({
      episodeId,
      translationId: parsed.data.translationId,
      modelName: parsed.data.modelName,
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Failed to discard episode translations", {
      err: err instanceof Error ? err.message : String(err),
      route: "DELETE /api/translations/episodes/:episodeId/discard",
    });
    return NextResponse.json({ error: "Failed to discard translations" }, { status: 500 });
  }
}
