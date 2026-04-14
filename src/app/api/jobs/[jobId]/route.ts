import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isValidUuid } from "@/lib/validation";
import { getJobRun } from "@/modules/jobs/application/job-runs";

interface Ctx {
  params: Promise<{ jobId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { jobId } = await ctx.params;
    if (!isValidUuid(jobId)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const job = await getJobRun(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      jobType: job.jobType,
      entityType: job.entityType,
      entityId: job.entityId,
      status: job.status,
      attemptCount: job.attemptCount,
      result: sanitizeJobResult(job.resultJson),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error("Failed to fetch job", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

function sanitizeJobResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const source = result as Record<string, unknown>;

  return {
    stage: typeof source.stage === "string" ? source.stage : null,
    discovered: toNumberOrNull(source.discovered),
    processed: toNumberOrNull(source.processed),
    total: toNumberOrNull(source.total),
    fetched: toNumberOrNull(source.fetched),
    failed: toNumberOrNull(source.failed),
    queued: toNumberOrNull(source.queued),
    entriesImported: toNumberOrNull(source.entriesImported),
    entriesSkipped: toNumberOrNull(source.entriesSkipped),
    episodeCount: toNumberOrNull(source.episodeCount),
    glossary: typeof source.glossary === "string" ? source.glossary : null,
    modelName: typeof source.modelName === "string" ? source.modelName : null,
    errorMessage: typeof source.errorMessage === "string" ? source.errorMessage : null,
  };
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
