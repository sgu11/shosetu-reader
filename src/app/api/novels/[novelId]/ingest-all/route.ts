import { NextRequest, NextResponse } from "next/server";
import { acquireRequestDeduplicationLock } from "@/lib/request-dedupe";
import { getNovelById } from "@/modules/catalog/application/get-novel";
import { discoverEpisodes } from "@/modules/catalog/application/ingest-episodes";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import type { IngestAllJobPayload } from "@/modules/jobs/application/job-handlers";
import { getActiveJobByKindAndEntity } from "@/modules/jobs/application/job-runs";
import { rateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

// 1 ingest-all request per minute per IP
const RATE_LIMIT = { limit: 1, windowSeconds: 60 };

/**
 * POST /api/novels/:novelId/ingest-all
 *
 * Discovers episodes then fetches ALL pending episodes in the background.
 * Returns immediately with 202 after starting the background job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ novelId: string }> },
) {
  const limited = await rateLimit(request, RATE_LIMIT, "ingest-all");
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
        discovered: 0,
        jobId: existingJob.id,
        runner: "redis",
        message: "Ingest job already in progress",
      },
      { status: 202 },
    );
  }

  const dedupe = await acquireRequestDeduplicationLock({
    scope: `ingest-all:${novelId}`,
    ttlMs: 10_000,
  });
  if (!dedupe.acquired) {
    return NextResponse.json({ error: "Ingest was requested recently" }, { status: 409 });
  }

  // Discover first (synchronous — fast, just TOC scrape)
  const discovered = await discoverEpisodes(novelId);
  const jobQueue = getJobQueue();
  const payload: IngestAllJobPayload = {
    novelId,
    limit: 9999,
    discovered,
    ownerUserId: "site",
  };

  const job = await jobQueue.enqueue(
    "catalog.ingest-all",
    payload,
    {
      entityType: "novel",
      entityId: novelId,
    },
  );

  return NextResponse.json(
    {
      novelId,
      discovered,
      jobId: job.id,
      runner: job.runner,
      message: "Fetching all pending episodes in background",
    },
    { status: 202 },
  );
}
