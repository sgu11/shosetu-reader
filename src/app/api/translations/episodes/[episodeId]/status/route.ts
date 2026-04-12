import { NextResponse } from "next/server";
import { getTranslationStatus } from "@/modules/translation/application/get-translation-status";

interface Ctx {
  params: Promise<{ episodeId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { episodeId } = await ctx.params;
    const status = await getTranslationStatus(episodeId);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
