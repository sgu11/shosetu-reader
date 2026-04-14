import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { jobRuns } from "@/lib/db/schema";
import type { JobKind } from "../domain/job-kind";

export interface JobRunResult {
  [key: string]: unknown;
}

export async function createJobRun(input: {
  jobId: string;
  jobType: JobKind;
  payload: unknown;
  entityType?: string;
  entityId?: string;
}) {
  const db = getDb();

  await db.insert(jobRuns).values({
    id: input.jobId,
    jobType: input.jobType,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    status: "queued",
    attemptCount: 0,
    payloadJson: input.payload,
    resultJson: null,
    updatedAt: new Date(),
  });
}

export async function markJobRunning(jobId: string, attemptCount: number = 1) {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      status: "running",
      attemptCount,
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function updateJobRunResult(jobId: string, result: JobRunResult) {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      resultJson: result,
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function markJobCompleted(jobId: string, result: JobRunResult) {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      status: "completed",
      resultJson: result,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function markJobFailed(jobId: string, result: JobRunResult) {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      status: "failed",
      resultJson: result,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function claimQueuedJob(jobId: string) {
  const db = getDb();

  const [row] = await db
    .update(jobRuns)
    .set({
      status: "running",
      attemptCount: sql`${jobRuns.attemptCount} + 1`,
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(jobRuns.id, jobId), eq(jobRuns.status, "queued")))
    .returning({
      id: jobRuns.id,
      jobType: jobRuns.jobType,
      payloadJson: jobRuns.payloadJson,
      attemptCount: jobRuns.attemptCount,
    });

  return row ?? null;
}

export async function requeueJob(jobId: string, result?: JobRunResult) {
  const db = getDb();

  await db
    .update(jobRuns)
    .set({
      status: "queued",
      resultJson: result ?? null,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobRuns.id, jobId));
}

export async function getJobRun(jobId: string) {
  const db = getDb();

  const [row] = await db
    .select()
    .from(jobRuns)
    .where(eq(jobRuns.id, jobId))
    .limit(1);

  return row ?? null;
}

export async function getLatestNovelJobForUser(input: {
  novelId: string;
  userId: string;
}) {
  const db = getDb();

  const rows = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.entityType, "novel"),
        eq(jobRuns.entityId, input.novelId),
        inArray(jobRuns.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(10);

  return rows.find((row) => getOwnerUserId(row.payloadJson) === input.userId) ?? null;
}

export async function getLatestNovelJob(novelId: string) {
  const db = getDb();

  const [row] = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.entityType, "novel"),
        eq(jobRuns.entityId, novelId),
        inArray(jobRuns.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getActiveJobByKindAndEntity(input: {
  jobType: JobKind;
  entityType: string;
  entityId: string;
}) {
  const db = getDb();

  const [row] = await db
    .select()
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobType, input.jobType),
        eq(jobRuns.entityType, input.entityType),
        eq(jobRuns.entityId, input.entityId),
        inArray(jobRuns.status, ["queued", "running"]),
      ),
    )
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);

  return row ?? null;
}

export async function listQueuedJobs(limit: number = 100) {
  const db = getDb();

  return db
    .select({
      id: jobRuns.id,
    })
    .from(jobRuns)
    .where(eq(jobRuns.status, "queued"))
    .orderBy(asc(jobRuns.createdAt))
    .limit(limit);
}

export async function listStaleRunningJobs(input: {
  staleBefore: Date;
  limit?: number;
}) {
  const db = getDb();

  return db
    .select({
      id: jobRuns.id,
    })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.status, "running"),
        lt(jobRuns.updatedAt, input.staleBefore),
      ),
    )
    .orderBy(asc(jobRuns.updatedAt))
    .limit(input.limit ?? 100);
}

function getOwnerUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const ownerUserId = (payload as Record<string, unknown>).ownerUserId;
  return typeof ownerUserId === "string" ? ownerUserId : null;
}
