import { NextRequest, NextResponse } from "next/server";
import { requestTranslation } from "@/modules/translation/application/request-translation";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

interface Ctx {
  params: Promise<{ episodeId: string }>;
}

// 10 translation requests per minute per IP
const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function POST(req: NextRequest, ctx: Ctx) {
  const limited = rateLimit(req, RATE_LIMIT, "translate");
  if (limited) return limited;

  try {
    const { episodeId } = await ctx.params;
    if (!isValidUuid(episodeId)) {
      return NextResponse.json({ error: "Invalid episode ID" }, { status: 400 });
    }
    // Optional model override from request body
    let modelOverride: string | undefined;
    try {
      const body = await req.json();
      if (body.modelName && typeof body.modelName === "string" && body.modelName.length <= 200) {
        modelOverride = body.modelName;
      }
    } catch {
      // No body or invalid JSON — use default model
    }
    const result = await requestTranslation(episodeId, modelOverride);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    console.error("Translation request failed:", err);
    return NextResponse.json({ error: "Translation request failed" }, { status: 400 });
  }
}
