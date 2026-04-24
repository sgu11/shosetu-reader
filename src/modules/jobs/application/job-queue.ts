import type { EnqueuedJob } from "../domain/enqueued-job";
import type { JobKind } from "../domain/job-kind";
import { env } from "@/lib/env";
import { InlineJobQueue } from "../infra/inline-job-queue";
import { RedisJobQueue } from "../infra/redis-job-queue";

export interface JobExecutionContext<TPayload = unknown> {
  job: EnqueuedJob<TPayload>;
  updateProgress(result: Record<string, unknown>): Promise<void>;
}

export interface JobEnqueueOptions {
  entityType?: string;
  entityId?: string;
  delayMs?: number;
}

export interface JobQueue {
  enqueue<TPayload>(
    kind: JobKind,
    payload: TPayload,
    options?: JobEnqueueOptions,
  ): Promise<EnqueuedJob<TPayload>>;
}

let activeJobQueue: JobQueue | undefined;

export function getJobQueue(): JobQueue {
  if (!activeJobQueue) {
    activeJobQueue = env.REDIS_URL
      ? new RedisJobQueue()
      : new InlineJobQueue();
  }

  return activeJobQueue;
}

export function setJobQueue(jobQueue: JobQueue) {
  activeJobQueue = jobQueue;
}
