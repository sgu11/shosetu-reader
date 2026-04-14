import { logger } from "@/lib/logger";
import { getRedisClient, isRedisConfigured } from "@/lib/redis/client";

const METRICS_KEY = "shosetu:metrics:counters:v1";
const METRICS_TTL_SECONDS = 60 * 60 * 24 * 30;

const memoryCounters = new Map<string, number>();

type MetricLabels = Record<string, string | number | boolean | null | undefined>;

function buildMetricField(metric: string, labels?: MetricLabels) {
  if (!labels) {
    return metric;
  }

  const suffix = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");

  return suffix ? `${metric}|${suffix}` : metric;
}

function incrementMemory(field: string, amount: number) {
  memoryCounters.set(field, (memoryCounters.get(field) ?? 0) + amount);
}

export async function incrementMetric(
  metric: string,
  amount = 1,
  labels?: MetricLabels,
) {
  const field = buildMetricField(metric, labels);

  if (!isRedisConfigured()) {
    incrementMemory(field, amount);
    return;
  }

  try {
    const redis = await getRedisClient();
    await redis.hIncrByFloat(METRICS_KEY, field, amount);
    await redis.expire(METRICS_KEY, METRICS_TTL_SECONDS);
  } catch (error) {
    logger.warn("Failed to increment metric in Redis, falling back to memory", {
      metric: field,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    incrementMemory(field, amount);
  }
}

export async function getMetricCounters(prefixes: string[] = []) {
  const result = new Map<string, number>();

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisClient();
      const rows = await redis.hGetAll(METRICS_KEY);

      for (const [field, rawValue] of Object.entries(rows)) {
        if (prefixes.length > 0 && !prefixes.some((prefix) => field.startsWith(prefix))) {
          continue;
        }

        const value = Number(rawValue);
        if (Number.isFinite(value)) {
          result.set(field, value);
        }
      }
    } catch (error) {
      logger.warn("Failed to read metrics from Redis, falling back to memory", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  for (const [field, value] of memoryCounters.entries()) {
    if (prefixes.length > 0 && !prefixes.some((prefix) => field.startsWith(prefix))) {
      continue;
    }

    result.set(field, (result.get(field) ?? 0) + value);
  }

  return Object.fromEntries([...result.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

export async function recordRateLimitHit(prefix: string) {
  await incrementMetric("rate_limit.hit", 1, { prefix });
}

export async function recordDedupedRequest(prefix: string) {
  await incrementMetric("request_dedupe.hit", 1, { prefix });
}

export async function recordOpenRouterError(operation: string, status?: number) {
  await incrementMetric("openrouter.error", 1, {
    operation,
    status: status ?? "unknown",
  });
}

export async function recordOpenRouterUsage(input: {
  operation: string;
  modelName: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
}) {
  await incrementMetric("openrouter.usage.count", 1, {
    operation: input.operation,
    model: input.modelName,
  });

  if (input.inputTokens != null) {
    await incrementMetric("openrouter.usage.input_tokens", input.inputTokens, {
      operation: input.operation,
      model: input.modelName,
    });
  }

  if (input.outputTokens != null) {
    await incrementMetric("openrouter.usage.output_tokens", input.outputTokens, {
      operation: input.operation,
      model: input.modelName,
    });
  }

  if (input.costUsd != null) {
    await incrementMetric("openrouter.usage.cost_usd", input.costUsd, {
      operation: input.operation,
      model: input.modelName,
    });
  }
}

export async function recordJobRetry(jobType: string) {
  await incrementMetric("jobs.retry", 1, { jobType });
}

export async function recordRecoveredStaleJob() {
  await incrementMetric("jobs.recovered_stale", 1);
}
