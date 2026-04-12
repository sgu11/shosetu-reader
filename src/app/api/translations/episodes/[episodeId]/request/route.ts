import { NextResponse } from "next/server";
import { requestTranslation } from "@/modules/translation/application/request-translation";

interface Ctx {
  params: Promise<{ episodeId: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { episodeId } = await ctx.params;
    const result = await requestTranslation(episodeId);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
