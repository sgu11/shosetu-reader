import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { recordOpenRouterError } from "@/lib/ops-metrics";
import { acquireRequestDeduplicationLock, releaseRequestDeduplicationLock } from "@/lib/request-dedupe";
import { getRedisClient, isRedisConfigured } from "@/lib/redis/client";

const CACHE_KEY = "shosetu:openrouter:models:v1";
const CACHE_TTL_SECONDS = 60 * 60;
const FETCH_LOCK_TTL_MS = 15_000;

interface CachedModelsPayload {
  fetchedAt: string;
  models: OpenRouterModel[];
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: string | null;
  completionPrice: string | null;
}

let memoryCache: CachedModelsPayload | null = null;

function isFresh(payload: CachedModelsPayload) {
  return Date.now() - new Date(payload.fetchedAt).getTime() < CACHE_TTL_SECONDS * 1000;
}

async function readCachedModels() {
  if (memoryCache && isFresh(memoryCache)) {
    return memoryCache;
  }

  if (!isRedisConfigured()) {
    return memoryCache;
  }

  try {
    const redis = await getRedisClient();
    const cached = await redis.get(CACHE_KEY);
    if (!cached) {
      return memoryCache;
    }

    const payload = JSON.parse(cached) as CachedModelsPayload;
    memoryCache = payload;
    return payload;
  } catch (error) {
    logger.warn("Failed to read OpenRouter models cache", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return memoryCache;
  }
}

async function writeCachedModels(payload: CachedModelsPayload) {
  memoryCache = payload;

  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redis = await getRedisClient();
    await redis.set(CACHE_KEY, JSON.stringify(payload), {
      EX: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn("Failed to write OpenRouter models cache", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function fetchModelsFromApi() {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key not configured");
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    await recordOpenRouterError("models", response.status);
    throw new Error(`OpenRouter API error ${response.status}`);
  }

  const data = await response.json();
  const models = Array.isArray(data.data) ? data.data : [];

  const normalized = models
    .map((model: {
      id?: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }) => ({
      id: model.id ?? "",
      name: model.name ?? model.id ?? "",
      contextLength: typeof model.context_length === "number" ? model.context_length : null,
      promptPrice: model.pricing?.prompt ?? null,
      completionPrice: model.pricing?.completion ?? null,
    }))
    .filter((model: OpenRouterModel) => model.id.length > 0)
    .sort((left: OpenRouterModel, right: OpenRouterModel) => left.name.localeCompare(right.name));

  return {
    fetchedAt: new Date().toISOString(),
    models: normalized,
  } satisfies CachedModelsPayload;
}

export async function getOpenRouterModels(options?: {
  forceRefresh?: boolean;
  allowStale?: boolean;
}) {
  const allowStale = options?.allowStale ?? true;
  const cached = options?.forceRefresh ? null : await readCachedModels();

  if (cached && isFresh(cached)) {
    return cached.models;
  }

  const lock = await acquireRequestDeduplicationLock({
    scope: "openrouter-models-refresh",
    ttlMs: FETCH_LOCK_TTL_MS,
  });

  if (!lock.acquired) {
    if (cached && allowStale) {
      return cached.models;
    }

    const retryAfterMs = (lock.retryAfterSeconds ?? 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfterMs, 1000)));
    const secondRead = await readCachedModels();
    if (secondRead) {
      return secondRead.models;
    }
  }

  try {
    const payload = await fetchModelsFromApi();
    await writeCachedModels(payload);
    return payload.models;
  } catch (error) {
    if (cached && allowStale) {
      logger.warn("Serving stale OpenRouter model cache after refresh failure", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return cached.models;
    }

    throw error;
  } finally {
    if (lock.acquired) {
      await releaseRequestDeduplicationLock({
        key: lock.key,
        token: lock.token,
      });
    }
  }
}

export async function getOpenRouterModelPricing(modelName: string) {
  const models = await getOpenRouterModels();
  const model = models.find((entry: OpenRouterModel) => entry.id === modelName);

  if (!model || !model.promptPrice || !model.completionPrice) {
    return null;
  }

  const promptPricePerToken = Number(model.promptPrice);
  const completionPricePerToken = Number(model.completionPrice);

  if (!Number.isFinite(promptPricePerToken) || !Number.isFinite(completionPricePerToken)) {
    return null;
  }

  return {
    promptPricePerToken,
    completionPricePerToken,
  };
}

export async function isKnownOpenRouterModel(modelName: string) {
  const models = await getOpenRouterModels();
  return models.some((model: OpenRouterModel) => model.id === modelName);
}
