import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getDb } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getMetricCounters } from "@/lib/ops-metrics";

/**
 * GET /api/admin/metrics
 *
 * Unified operational metrics: job queue health, translation throughput,
 * failure rates, and system overview. Designed for an admin dashboard.
 */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getDb();

    const [
      queueHealth,
      translationThroughput,
      recentActivity,
      systemOverview,
      queueLag,
      retrySummary,
      metricsCounters,
    ] =
      await Promise.all([
        // Queue health: counts by status
        db.execute<{
          status: string;
          count: number;
          avg_duration_ms: number | null;
        }>(sql`
          SELECT
            status,
            count(*)::int AS count,
            round(avg(
              CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
              THEN extract(epoch FROM (completed_at - started_at)) * 1000
              ELSE NULL END
            ))::int AS avg_duration_ms
          FROM job_runs
          GROUP BY status
          ORDER BY
            CASE status
              WHEN 'running' THEN 1
              WHEN 'queued' THEN 2
              WHEN 'failed' THEN 3
              WHEN 'completed' THEN 4
            END
        `),

        // Translation throughput: last 24h, last 7d, all-time
        db.execute<{
          period: string;
          translations: number;
          avg_duration_ms: number | null;
          total_cost_usd: number;
          episodes_translated: number;
        }>(sql`
          SELECT * FROM (
            SELECT
              '24h' AS period,
              count(*)::int AS translations,
              round(avg(duration_ms))::int AS avg_duration_ms,
              round(coalesce(sum(estimated_cost_usd), 0)::numeric, 4) AS total_cost_usd,
              count(DISTINCT episode_id)::int AS episodes_translated
            FROM translations
            WHERE status = 'available' AND completed_at > now() - interval '24 hours'
            UNION ALL
            SELECT
              '7d' AS period,
              count(*)::int AS translations,
              round(avg(duration_ms))::int AS avg_duration_ms,
              round(coalesce(sum(estimated_cost_usd), 0)::numeric, 4) AS total_cost_usd,
              count(DISTINCT episode_id)::int AS episodes_translated
            FROM translations
            WHERE status = 'available' AND completed_at > now() - interval '7 days'
            UNION ALL
            SELECT
              'all' AS period,
              count(*)::int AS translations,
              round(avg(duration_ms))::int AS avg_duration_ms,
              round(coalesce(sum(estimated_cost_usd), 0)::numeric, 4) AS total_cost_usd,
              count(DISTINCT episode_id)::int AS episodes_translated
            FROM translations
            WHERE status = 'available'
          ) sub
          ORDER BY CASE period WHEN '24h' THEN 1 WHEN '7d' THEN 2 ELSE 3 END
        `),

        // Recent activity: last 10 jobs
        db.execute<{
          id: string;
          job_type: string;
          status: string;
          duration_ms: number | null;
          created_at: string;
        }>(sql`
          SELECT
            id,
            job_type,
            status,
            CASE WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
              THEN round(extract(epoch FROM (completed_at - started_at)) * 1000)::int
              ELSE NULL END AS duration_ms,
            created_at::text
          FROM job_runs
          ORDER BY created_at DESC
          LIMIT 10
        `),

        // System overview
        db.execute<{
          total_novels: number;
          total_episodes: number;
          fetched_episodes: number;
          total_translations: number;
          total_subscriptions: number;
        }>(sql`
          SELECT
            (SELECT count(*)::int FROM novels) AS total_novels,
            (SELECT count(*)::int FROM episodes) AS total_episodes,
            (SELECT count(*)::int FROM episodes WHERE fetch_status = 'fetched') AS fetched_episodes,
            (SELECT count(*)::int FROM translations WHERE status = 'available') AS total_translations,
            (SELECT count(*)::int FROM subscriptions WHERE is_active = true) AS total_subscriptions
        `),
        db.execute<{
          oldest_queued_at: string | null;
          queued_count: number;
        }>(sql`
          SELECT
            min(created_at)::text AS oldest_queued_at,
            count(*)::int AS queued_count
          FROM job_runs
          WHERE status = 'queued'
        `),
        db.execute<{
          retried_jobs: number;
          max_attempt_count: number | null;
        }>(sql`
          SELECT
            count(*) FILTER (WHERE attempt_count > 1)::int AS retried_jobs,
            max(attempt_count)::int AS max_attempt_count
          FROM job_runs
        `),
        getMetricCounters([
          "rate_limit.hit",
          "request_dedupe.hit",
          "openrouter.error",
          "openrouter.usage",
          "jobs.retry",
          "jobs.recovered_stale",
        ]),
      ]);

    const queueLagRow = queueLag[0] ?? null;
    const oldestQueuedAt = queueLagRow?.oldest_queued_at
      ? new Date(queueLagRow.oldest_queued_at)
      : null;

    return NextResponse.json({
      queueHealth: [...queueHealth],
      queueLag: {
        queuedCount: queueLagRow?.queued_count ?? 0,
        oldestQueuedAt: oldestQueuedAt?.toISOString() ?? null,
        oldestQueuedAgeMs: oldestQueuedAt
          ? Math.max(0, Date.now() - oldestQueuedAt.getTime())
          : 0,
      },
      translationThroughput: [...translationThroughput],
      recentJobs: [...recentActivity],
      retries: retrySummary[0] ?? { retried_jobs: 0, max_attempt_count: 0 },
      counters: metricsCounters,
      system: systemOverview[0] ?? null,
    });
  } catch (err) {
    logger.error("Failed to fetch admin metrics", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
