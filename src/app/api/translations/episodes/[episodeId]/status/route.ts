import { NextResponse } from "next/server";
import { getTranslationStatus } from "@/modules/translation/application/get-translation-status";
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
    console.error("Failed to get translation status:", err);
    return NextResponse.json({ error: "Failed to get translation status" }, { status: 500 });
  }
}
