import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";
import { discardNovelTranslationsInputSchema } from "@/modules/translation/api/schemas";
import { discardNovelTranslations } from "@/modules/translation/application/discard-translations";

interface Ctx {
  params: Promise<{ novelId: string }>;
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Allow empty body.
    }

    const parsed = discardNovelTranslationsInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await discardNovelTranslations({
      novelId,
      modelName: parsed.data.modelName,
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Failed to discard novel translations", {
      err: err instanceof Error ? err.message : String(err),
      route: "DELETE /api/novels/:novelId/translations/discard",
    });
    return NextResponse.json({ error: "Failed to discard translations" }, { status: 500 });
  }
}
