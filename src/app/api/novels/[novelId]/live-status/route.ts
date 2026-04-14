import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/validation";
import { getNovelLiveStatus } from "@/modules/catalog/application/get-novel-live-status";

interface Ctx {
  params: Promise<{ novelId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }

    const status = await getNovelLiveStatus(novelId);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Failed to fetch live status" }, { status: 500 });
  }
}
