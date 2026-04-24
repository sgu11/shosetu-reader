import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getDb();

    // Per-model translation speed and throughput statistics
    const modelStats = await db.execute<{
      model_name: string;
      total_translations: number;
      avg_duration_ms: number;
      median_duration_ms: number;
      p95_duration_ms: number;
      avg_chars_per_second: number;
      total_cost_usd: number;
      avg_cost_usd: number;
      last_used: string;
    }>(sql`
      SELECT
        t.model_name,
        count(*)::int AS total_translations,
        round(avg(t.duration_ms))::int AS avg_duration_ms,
        round(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.duration_ms))::int AS median_duration_ms,
        round(percentile_cont(0.95) WITHIN GROUP (ORDER BY t.duration_ms))::int AS p95_duration_ms,
        round(avg(
          CASE WHEN length(trim(e.normalized_text_ja)) > 0 AND t.duration_ms > 0
          THEN length(trim(e.normalized_text_ja))::numeric / (t.duration_ms::numeric / 1000)
          ELSE NULL END
        ))::int AS avg_chars_per_second,
        round(coalesce(sum(t.estimated_cost_usd), 0)::numeric, 4) AS total_cost_usd,
        round(coalesce(avg(t.estimated_cost_usd), 0)::numeric, 6) AS avg_cost_usd,
        max(t.completed_at)::text AS last_used
      FROM translations t
      JOIN episodes e ON e.id = t.episode_id
      WHERE t.status = 'available'
        AND t.duration_ms IS NOT NULL
        AND t.duration_ms > 0
      GROUP BY t.model_name
      ORDER BY count(*) DESC
    `);

    // Recent failure rates (last 24h)
    const failureStats = await db.execute<{
      model_name: string;
      total: number;
      failed: number;
      failure_rate: number;
    }>(sql`
      SELECT
        model_name,
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'failed')::int AS failed,
        round(
          count(*) FILTER (WHERE status = 'failed')::numeric / NULLIF(count(*), 0) * 100, 1
        ) AS failure_rate
      FROM translations
      WHERE created_at > now() - interval '24 hours'
      GROUP BY model_name
      ORDER BY count(*) DESC
    `);

    return NextResponse.json({
      modelStats: [...modelStats],
      recentFailures: [...failureStats],
    });
  } catch (err) {
    logger.error("Failed to fetch translation trends", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/admin/translations/trends",
    });
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
