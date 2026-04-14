import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { recordRateLimitHit } from "@/lib/ops-metrics";
import { getRedisClient, isRedisConfigured } from "@/lib/redis/client";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

function createRateLimitResponse(input: {
  limit: number;
  remaining: number;
  resetAt: number;
}) {
  const retryAfter = Math.max(1, Math.ceil((input.resetAt - Date.now()) / 1000));

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(input.limit),
        "X-RateLimit-Remaining": String(Math.max(0, input.remaining)),
        "X-RateLimit-Reset": String(Math.ceil(input.resetAt / 1000)),
      },
    },
  );
}

async function rateLimitWithRedis(
  key: string,
  config: RateLimitConfig,
) {
  const redis = await getRedisClient();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, config.windowSeconds);
  }

  const ttlSeconds = await redis.ttl(key);
  const resetAt = Date.now() + Math.max(ttlSeconds, 1) * 1000;
  const remaining = config.limit - count;

  if (count > config.limit) {
    return createRateLimitResponse({
      limit: config.limit,
      remaining,
      resetAt,
    });
  }

  return null;
}

function rateLimitInMemory(
  key: string,
  config: RateLimitConfig,
) {
  cleanup();

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return null;
  }

  existing.count += 1;

  if (existing.count > config.limit) {
    return createRateLimitResponse({
      limit: config.limit,
      remaining: config.limit - existing.count,
      resetAt: existing.resetAt,
    });
  }

  return null;
}

export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  prefix = "global",
) {
  const ip = getClientIp(req);
  const key = `${prefix}:${ip}`;

  try {
    const response = isRedisConfigured()
      ? await rateLimitWithRedis(`shosetu:ratelimit:${key}`, config)
      : rateLimitInMemory(key, config);

    if (response) {
      await recordRateLimitHit(prefix);
    }

    return response;
  } catch (error) {
    logger.warn("Rate limiter failed, falling back to memory bucket", {
      prefix,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const response = rateLimitInMemory(key, config);
    if (response) {
      await recordRateLimitHit(prefix);
    }
    return response;
  }
}

function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }

  return "unknown";
}
