import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { jobRuns } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const db = getDb();
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    let query = db.select().from(jobRuns).$dynamic();

    if (status) {
      query = query.where(
        eq(jobRuns.status, status as "queued" | "running" | "completed" | "failed"),
      );
    }

    const rows = await query
      .orderBy(desc(jobRuns.createdAt))
      .limit(limit);

    return NextResponse.json({
      jobs: rows.map((row) => ({
        id: row.id,
        jobType: row.jobType,
        entityType: row.entityType,
        entityId: row.entityId,
        status: row.status,
        attemptCount: row.attemptCount,
        payload: row.payloadJson,
        result: row.resultJson,
        startedAt: row.startedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      count: rows.length,
    });
  } catch (err) {
    logger.error("Failed to fetch jobs", {
      err: err instanceof Error ? err.message : String(err),
      route: "GET /api/admin/jobs",
    });
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
