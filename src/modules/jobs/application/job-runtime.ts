import { logger } from "@/lib/logger";
import { createRedisConnection, getRedisClient } from "@/lib/redis/client";
import { getJobHandler } from "./job-handlers";
import {
  claimQueuedJob,
  getJobRun,
  listQueuedJobs,
  listStaleRunningJobs,
  markJobCompleted,
  markJobFailed,
  requeueJob,
  updateJobRunResult,
  type JobRunResult,
} from "./job-runs";
import type { JobExecutionContext } from "./job-queue";
import type { EnqueuedJob } from "../domain/enqueued-job";
import type { JobKind } from "../domain/job-kind";

const queueKeys = {
  pending: "shosetu:jobs:pending",
  delayed: "shosetu:jobs:delayed",
} as const;

const runtimeConfig = {
  popTimeoutSeconds: 5,
  maxAttempts: 3,
  staleAfterMs: 30 * 60 * 1000,
  delayedPollLimit: 100,
  reconcileLimit: 100,
  reconcileEveryMs: 30_000,
  recoverEveryMs: 30_000,
} as const;

export async function publishJobToQueue(jobId: string) {
  const redis = await getRedisClient();
  await redis.rPush(queueKeys.pending, jobId);
}

export async function publishJobWithDelay(jobId: string, delayMs: number) {
  const redis = await getRedisClient();
  await redis.zAdd(queueKeys.delayed, {
    score: Date.now() + delayMs,
    value: jobId,
  });
}

export async function startJobWorker() {
  const redis = await createRedisConnection();
  let shuttingDown = false;
  let lastQueuedReconcileAt = 0;
  let lastRecoveryAt = 0;

  const shutdown = async () => {
    shuttingDown = true;
    await redis.quit();
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  logger.info("Job worker started");

  while (!shuttingDown) {
    try {
      await moveDelayedJobsToPending();
      if (Date.now() - lastQueuedReconcileAt >= runtimeConfig.reconcileEveryMs) {
        await reconcileQueuedJobs();
        lastQueuedReconcileAt = Date.now();
      }
      if (Date.now() - lastRecoveryAt >= runtimeConfig.recoverEveryMs) {
        await recoverStaleRunningJobs();
        lastRecoveryAt = Date.now();
      }

      const entry = await redis.blPop(queueKeys.pending, runtimeConfig.popTimeoutSeconds);
      if (!entry?.element) {
        continue;
      }

      await processJob(entry.element);
    } catch (error) {
      logger.error("Job worker loop failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await sleep(1000);
    }
  }

  logger.info("Job worker stopped");
}

async function processJob(jobId: string) {
  const claimed = await claimQueuedJob(jobId);
  if (!claimed) {
    return;
  }

  const handler = getJobHandler(claimed.jobType as JobKind);
  const payload = claimed.payloadJson;
  const attemptCount = claimed.attemptCount;

  if (!handler) {
    await markJobFailed(jobId, { errorMessage: `No handler registered for ${claimed.jobType}` });
    return;
  }

  const jobRow = await getJobRun(jobId);
  if (!jobRow) {
    return;
  }

  const job: EnqueuedJob = {
    id: jobRow.id,
    kind: claimed.jobType as JobKind,
    payload,
    runner: "redis",
    acceptedAt: jobRow.createdAt.toISOString(),
    entityType: jobRow.entityType,
    entityId: jobRow.entityId,
  };

  let latestResult: JobRunResult = {};
  const context: JobExecutionContext = {
    job,
    updateProgress: async (result) => {
      latestResult = {
        ...latestResult,
        ...result,
      };

      await updateJobRunResult(jobId, latestResult);
    },
  };

  try {
    const result = await handler(payload, context);
    const finalResult = result
      ? {
          ...latestResult,
          ...result,
        }
      : latestResult;

    await markJobCompleted(jobId, finalResult);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorResult = {
      ...latestResult,
      errorMessage,
    };

    if (attemptCount < runtimeConfig.maxAttempts) {
      await requeueJob(jobId, errorResult);
      await publishJobWithDelay(jobId, getRetryDelayMs(attemptCount));

      logger.warn("Job scheduled for retry", {
        jobId,
        attemptCount,
        errorMessage,
      });
      return;
    }

    await markJobFailed(jobId, errorResult);

    logger.error("Job failed permanently", {
      jobId,
      attemptCount,
      errorMessage,
    });
  }
}

async function moveDelayedJobsToPending() {
  const redis = await getRedisClient();
  const dueJobIds = await redis.zRangeByScore(
    queueKeys.delayed,
    0,
    Date.now(),
    { LIMIT: { offset: 0, count: runtimeConfig.delayedPollLimit } },
  );

  for (const jobId of dueJobIds) {
    await redis.zRem(queueKeys.delayed, jobId);
    await redis.rPush(queueKeys.pending, jobId);
  }
}

async function reconcileQueuedJobs() {
  const queuedJobs = await listQueuedJobs(runtimeConfig.reconcileLimit);
  if (queuedJobs.length === 0) {
    return;
  }

  const redis = await getRedisClient();
  for (const job of queuedJobs) {
    await redis.rPush(queueKeys.pending, job.id);
  }
}

async function recoverStaleRunningJobs() {
  const staleJobs = await listStaleRunningJobs({
    staleBefore: new Date(Date.now() - runtimeConfig.staleAfterMs),
    limit: runtimeConfig.reconcileLimit,
  });

  for (const job of staleJobs) {
    await requeueJob(job.id, {
      errorMessage: "Recovered stale running job",
    });
    await publishJobToQueue(job.id);
  }
}

function getRetryDelayMs(attemptCount: number) {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attemptCount - 1));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
