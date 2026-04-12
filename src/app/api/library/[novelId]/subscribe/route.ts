import { NextResponse } from "next/server";
import { subscribeToNovel, unsubscribeFromNovel } from "@/modules/library/application/subscribe";
import { isValidUuid } from "@/lib/validation";

interface Ctx {
  params: Promise<{ novelId: string }>;
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const result = await subscribeToNovel(novelId);
    return NextResponse.json(result, { status: result.isNew ? 201 : 200 });
  } catch (err) {
    console.error("Subscribe failed:", err);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { novelId } = await ctx.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const removed = await unsubscribeFromNovel(novelId);

    if (!removed) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unsubscribe failed:", err);
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 400 });
  }
}
