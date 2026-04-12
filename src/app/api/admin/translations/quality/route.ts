import { NextRequest, NextResponse } from "next/server";
import { desc, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/admin-guard";

/**
 * GET /api/admin/translations/quality
 *
 * Returns translations that have quality warnings, most recent first.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getDb();
    const limit = Math.min(
      Number(req.nextUrl.searchParams.get("limit") ?? 50),
      100,
    );

    const rows = await db
      .select({
        id: translations.id,
        episodeId: translations.episodeId,
        modelName: translations.modelName,
        status: translations.status,
        qualityWarnings: translations.qualityWarnings,
        chunkCount: translations.chunkCount,
        completedAt: translations.completedAt,
      })
      .from(translations)
      .where(isNotNull(translations.qualityWarnings))
      .orderBy(desc(translations.completedAt))
      .limit(limit);

    return NextResponse.json({
      translations: rows.map((row) => ({
        ...row,
        completedAt: row.completedAt?.toISOString() ?? null,
      })),
      count: rows.length,
    });
  } catch (err) {
    console.error("Failed to fetch quality warnings:", err);
    return NextResponse.json(
      { error: "Failed to fetch quality warnings" },
      { status: 500 },
    );
  }
}
