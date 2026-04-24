import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getDb();
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") ?? "failed";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    const rows = await db
      .select({
        id: translations.id,
        episodeId: translations.episodeId,
        targetLanguage: translations.targetLanguage,
        provider: translations.provider,
        modelName: translations.modelName,
        status: translations.status,
        errorCode: translations.errorCode,
        errorMessage: translations.errorMessage,
        createdAt: translations.createdAt,
        completedAt: translations.completedAt,
      })
      .from(translations)
      .where(
        eq(
          translations.status,
          status as "queued" | "processing" | "available" | "failed",
        ),
      )
      .orderBy(desc(translations.createdAt))
      .limit(limit);

    return NextResponse.json({
      translations: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
      count: rows.length,
    });
  } catch (err) {
    logger.error("Failed to fetch translations", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/admin/translations",
    });
    return NextResponse.json({ error: "Failed to fetch translations" }, { status: 500 });
  }
}
