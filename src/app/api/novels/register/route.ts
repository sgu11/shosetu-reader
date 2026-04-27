import { NextRequest, NextResponse } from "next/server";
import { registerNovelInputSchema } from "@/modules/source/api/schemas";
import { registerNovel } from "@/modules/catalog/application/register-novel";
import { SyosetuApiError } from "@/modules/source/infra/syosetu-api";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// 5 novel registrations per minute per IP
const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMIT, "register");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = registerNovelInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await registerNovel(parsed.data.id, parsed.data.site);
    return NextResponse.json(result, { status: result.isNew ? 201 : 200 });
  } catch (err) {
    if (err instanceof SyosetuApiError) {
      const status = err.statusCode === 404 ? 404 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    logger.error("Registration failed", {
      err: err instanceof Error ? err.message : String(err),
      route: "POST /api/novels/register",
    });
    return NextResponse.json(
      { error: "Internal server error during registration" },
      { status: 500 },
    );
  }
}
