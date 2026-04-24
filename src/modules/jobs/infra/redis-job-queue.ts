import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import {
  publishJobToQueue,
  publishJobWithDelay,
} from "../application/job-runtime";
import type { JobEnqueueOptions, JobQueue } from "../application/job-queue";
import { createJobRun } from "../application/job-runs";
import type { EnqueuedJob } from "../domain/enqueued-job";
import type { JobKind } from "../domain/job-kind";

export class RedisJobQueue implements JobQueue {
  async enqueue<TPayload>(
    kind: JobKind,
    payload: TPayload,
    options?: JobEnqueueOptions,
  ): Promise<EnqueuedJob<TPayload>> {
    const job: EnqueuedJob<TPayload> = {
      id: randomUUID(),
      kind,
      payload,
      runner: "redis",
      acceptedAt: new Date().toISOString(),
      entityType: options?.entityType ?? null,
      entityId: options?.entityId ?? null,
    };

    await createJobRun({
      jobId: job.id,
      jobType: job.kind,
      payload: job.payload,
      entityType: job.entityType ?? undefined,
      entityId: job.entityId ?? undefined,
    });

    if (options?.delayMs) {
      await publishJobWithDelay(job.id, options.delayMs);
    } else {
      await publishJobToQueue(job.id);
    }

    logger.info("Redis job accepted", {
      jobId: job.id,
      kind: job.kind,
    });

    return job;
  }
}
