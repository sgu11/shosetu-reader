import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
}

// 10 model list requests per minute per IP
const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, RATE_LIMIT, "models");
  if (limited) return limited;
  try {
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `OpenRouter API error: ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const models: OpenRouterModel[] = data.data ?? [];

    // Return a simplified list sorted by name
    const simplified = models
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length ?? null,
        promptPrice: m.pricing?.prompt ?? null,
        completionPrice: m.pricing?.completion ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ models: simplified });
  } catch (err) {
    console.error("Failed to fetch models:", err);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
