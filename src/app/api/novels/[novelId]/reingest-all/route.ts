import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { acquireRequestDeduplicationLock } from "@/lib/request-dedupe";
import { getDb } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema";
import { getNovelById } from "@/modules/catalog/application/get-novel";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import type { IngestAllJobPayload } from "@/modules/jobs/application/job-handlers";
import { getActiveJobByKindAndEntity } from "@/modules/jobs/application/job-runs";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

// 1 reingest request per 2 minutes per IP (heavy operation)
const RATE_LIMIT = { limit: 1, windowSeconds: 120 };

/**
 * POST /api/novels/:novelId/reingest-all
 *
 * V5.3: Iterates all fetched episodes and reconciles each against its
 * source checksum. Only episodes whose source HTML has actually changed
 * incur a DB write (and implicit translation drift). Unchanged episodes
 * bump lastFetchedAt only. Useful after scraper improvements and for
 * periodic "catch up to source edits" runs without burning DB churn.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "reingest-all");
  if (limited) return limited;

  const { novelId } = await params;
  if (!isValidUuid(novelId)) {
    return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
  }

  const novel = await getNovelById(novelId);
  if (!novel) {
    return NextResponse.json({ error: "Novel not found" }, { status: 404 });
  }

  const existingJob = await getActiveJobByKindAndEntity({
    jobType: "catalog.ingest-all",
    entityType: "novel",
    entityId: novelId,
  });
  if (existingJob) {
    return NextResponse.json(
      {
        novelId,
        reset: 0,
        jobId: existingJob.id,
        runner: "redis",
        message: "Re-ingest job already in progress",
      },
      { status: 202 },
    );
  }

  const dedupe = await acquireRequestDeduplicationLock({
    scope: `reingest-all:${novelId}`,
    ttlMs: 10_000,
  });
  if (!dedupe.acquired) {
    return NextResponse.json({ error: "Re-ingest was requested recently" }, { status: 409 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(episodes)
    .where(and(eq(episodes.novelId, novelId), eq(episodes.fetchStatus, "fetched")));

  const fetchedCount = Number(count);
  if (fetchedCount === 0) {
    return NextResponse.json({
      novelId,
      reset: 0,
      message: "No fetched episodes to reconcile",
    });
  }

  const jobQueue = getJobQueue();
  const payload: IngestAllJobPayload = {
    novelId,
    limit: 9999,
    discovered: 0,
    ownerUserId: "site",
    reconcile: true,
  };

  const job = await jobQueue.enqueue(
    "catalog.ingest-all",
    payload,
    { entityType: "novel", entityId: novelId },
  );

  return NextResponse.json(
    {
      novelId,
      reset: fetchedCount,
      jobId: job.id,
      runner: job.runner,
      message: `Reconciling ${fetchedCount} episodes in background — unchanged sources will skip DB writes`,
    },
    { status: 202 },
  );
}
