import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getOpenRouterModels } from "@/lib/openrouter/models-cache";
import { rateLimit } from "@/lib/rate-limit";

// 10 model list requests per minute per IP
const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, RATE_LIMIT, "models");
  if (limited) return limited;
  try {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    const models = await getOpenRouterModels();
    return NextResponse.json({ models });
  } catch (err) {
    logger.error("Failed to fetch OpenRouter models", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
