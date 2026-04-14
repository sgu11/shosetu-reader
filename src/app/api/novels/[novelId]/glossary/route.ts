import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { acquireRequestDeduplicationLock } from "@/lib/request-dedupe";
import { rateLimit } from "@/lib/rate-limit";
import {
  getGlossary,
  updateGlossary,
  estimateGlossaryInput,
} from "@/modules/translation/application/generate-glossary";
import { getActiveJobByKindAndEntity } from "@/modules/jobs/application/job-runs";
import { getJobQueue } from "@/modules/jobs/application/job-queue";
import type { GlossaryGeneratePayload } from "@/modules/jobs/application/job-handlers";
import { isValidUuid } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ novelId: string }>;
}

const GLOSSARY_GENERATE_LIMIT = { limit: 1, windowSeconds: 60 };
const GLOSSARY_WRITE_LIMIT = { limit: 10, windowSeconds: 60 };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const estimate = req.nextUrl.searchParams.get("estimate");

    if (estimate === "true") {
      const est = await estimateGlossaryInput(novelId);
      return NextResponse.json({
        episodeCount: est.episodeCount,
        inputChars: est.inputChars,
      });
    }

    const [row, activeJob] = await Promise.all([
      getGlossary(novelId),
      getActiveJobByKindAndEntity({
        jobType: "glossary.generate",
        entityType: "novel",
        entityId: novelId,
      }),
    ]);

    return NextResponse.json({
      glossary: row?.glossary ?? "",
      modelName: row?.modelName ?? null,
      episodeCount: row?.episodeCount ?? null,
      generatedAt: row?.generatedAt ?? null,
      activeJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
          }
        : null,
    });
  } catch (err) {
    logger.error("Failed to fetch glossary", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to fetch glossary" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const limited = await rateLimit(req, GLOSSARY_WRITE_LIMIT, "glossary-write");
  if (limited) return limited;

  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }
    const body = await req.json();
    const glossary = typeof body.glossary === "string" ? body.glossary : "";

    if (glossary.length > 50000) {
      return NextResponse.json(
        { error: "Glossary too long (max 50000 characters)" },
        { status: 400 },
      );
    }

    await updateGlossary(novelId, glossary);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("Failed to update glossary", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json({ error: "Failed to update glossary" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const limited = await rateLimit(req, GLOSSARY_GENERATE_LIMIT, "glossary-generate");
  if (limited) return limited;

  try {
    const { novelId } = await context.params;
    if (!isValidUuid(novelId)) {
      return NextResponse.json({ error: "Invalid novel ID" }, { status: 400 });
    }

    const existingJob = await getActiveJobByKindAndEntity({
      jobType: "glossary.generate",
      entityType: "novel",
      entityId: novelId,
    });
    if (existingJob) {
      return NextResponse.json(
        {
          jobId: existingJob.id,
          status: existingJob.status,
          message: "Glossary generation already in progress",
        },
        { status: 202 },
      );
    }

    const dedupe = await acquireRequestDeduplicationLock({
      scope: `glossary.generate:${novelId}`,
      ttlMs: 10_000,
    });
    if (!dedupe.acquired) {
      return NextResponse.json(
        { error: "Glossary generation was requested recently" },
        {
          status: 409,
          headers: {
            "Retry-After": String(dedupe.retryAfterSeconds ?? 1),
          },
        },
      );
    }

    let modelName: string | undefined;
    try {
      const body = await req.json();
      modelName = typeof body.model === "string" ? body.model : undefined;
    } catch {
      // no body is fine — use default model
    }

    const queue = getJobQueue();
    const job = await queue.enqueue(
      "glossary.generate",
      {
        novelId,
        modelName,
      } satisfies GlossaryGeneratePayload,
      {
        entityType: "novel",
        entityId: novelId,
      },
    );

    return NextResponse.json(
      {
        jobId: job.id,
        status: "queued",
        message: "Glossary generation queued",
      },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("Failed to queue glossary generation", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
