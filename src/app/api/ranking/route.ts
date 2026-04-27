import { NextRequest, NextResponse } from "next/server";
import { getRanking } from "@/modules/catalog/application/get-ranking";
import {
  getRankingSections,
  type RankingScope,
} from "@/modules/catalog/application/get-ranking-sections";
import { resolveActiveProfileContext } from "@/modules/identity/application/profiles";
import { resolveAdultContext } from "@/modules/catalog/application/adult-context";
import type { RankingPeriod } from "@/modules/source/domain/source-adapter";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const SYOSETU_PERIODS = new Set<RankingPeriod>([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
]);

const ALL_PERIODS = new Set<RankingPeriod>([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "entire",
  "hot",
]);

const VALID_SCOPES = new Set<RankingScope>([
  "sfw",
  "all",
  "syosetu",
  "nocturne",
  "kakuyomu",
  "alphapolis",
]);

const RATE_LIMIT_CONFIG = { limit: 20, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, RATE_LIMIT_CONFIG, "ranking");
  if (limited) return limited;
  try {
    const { searchParams } = req.nextUrl;
    const period = (searchParams.get("period") ?? "daily") as RankingPeriod;
    const scopeParam = (searchParams.get("scope") ?? "syosetu") as RankingScope;
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

    if (!ALL_PERIODS.has(period)) {
      return NextResponse.json(
        { error: `Invalid period. Use one of: ${Array.from(ALL_PERIODS).join(", ")}` },
        { status: 400 },
      );
    }
    if (!VALID_SCOPES.has(scopeParam)) {
      return NextResponse.json(
        { error: `Invalid scope. Use one of: ${Array.from(VALID_SCOPES).join(", ")}` },
        { status: 400 },
      );
    }

    // Backwards-compatible single-list path: the original ranking page only
    // knows about syosetu and consumes a flat `items` array. Keep that path
    // identical to avoid breaking the deployed UI before Phase 6 ships the
    // grouped client.
    if (scopeParam === "syosetu" && SYOSETU_PERIODS.has(period)) {
      const items = await getRanking(period, limit);
      return NextResponse.json(
        { items, period },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
          },
        },
      );
    }

    const profile = await resolveActiveProfileContext();
    const ctx = await resolveAdultContext(profile?.userId ?? null);

    const sections = await getRankingSections({
      scope: scopeParam,
      period,
      limit,
      ctx,
    });

    return NextResponse.json(
      { sections, period, scope: scopeParam },
      {
        headers: {
          // Per-profile filtering: keep the response private and short-lived.
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
          Vary: "Cookie",
        },
      },
    );
  } catch (err) {
    logger.error("Failed to fetch ranking", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/ranking",
    });
    return NextResponse.json({ error: "Failed to fetch ranking" }, { status: 500 });
  }
}
