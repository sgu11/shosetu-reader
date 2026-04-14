import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { recordDedupedRequest } from "@/lib/ops-metrics";
import { getRedisClient, isRedisConfigured } from "@/lib/redis/client";

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function cleanupMemoryLocks(now: number) {
  for (const [key, lock] of memoryLocks.entries()) {
    if (lock.expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
}

export async function acquireRequestDeduplicationLock(input: {
  scope: string;
  ttlMs: number;
}) {
  const token = randomUUID();
  const key = `shosetu:dedupe:${input.scope}`;

  if (!isRedisConfigured()) {
    const now = Date.now();
    cleanupMemoryLocks(now);

    const existing = memoryLocks.get(key);
    if (existing && existing.expiresAt > now) {
      await recordDedupedRequest(input.scope);
      return {
        acquired: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      };
    }

    memoryLocks.set(key, {
      token,
      expiresAt: now + input.ttlMs,
    });

    return {
      acquired: true as const,
      retryAfterSeconds: null,
      token,
      key,
    };
  }

  try {
    const redis = await getRedisClient();
    const result = await redis.set(key, token, {
      NX: true,
      PX: input.ttlMs,
    });

    if (result !== "OK") {
      const ttl = await redis.pTTL(key);
      await recordDedupedRequest(input.scope);
      return {
        acquired: false as const,
        retryAfterSeconds: ttl > 0 ? Math.max(1, Math.ceil(ttl / 1000)) : Math.ceil(input.ttlMs / 1000),
      };
    }

    return {
      acquired: true as const,
      retryAfterSeconds: null,
      token,
      key,
    };
  } catch (error) {
    logger.warn("Failed to acquire Redis dedupe lock, falling back to memory", {
      scope: input.scope,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const now = Date.now();
    cleanupMemoryLocks(now);
    const existing = memoryLocks.get(key);
    if (existing && existing.expiresAt > now) {
      await recordDedupedRequest(input.scope);
      return {
        acquired: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
      };
    }

    memoryLocks.set(key, {
      token,
      expiresAt: now + input.ttlMs,
    });

    return {
      acquired: true as const,
      retryAfterSeconds: null,
      token,
      key,
    };
  }
}

export async function releaseRequestDeduplicationLock(input: {
  key: string;
  token: string;
}) {
  if (!isRedisConfigured()) {
    const existing = memoryLocks.get(input.key);
    if (existing?.token === input.token) {
      memoryLocks.delete(input.key);
    }
    return;
  }

  try {
    const redis = await getRedisClient();
    const existing = await redis.get(input.key);
    if (existing === input.token) {
      await redis.del(input.key);
    }
  } catch (error) {
    logger.warn("Failed to release dedupe lock", {
      key: input.key,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
