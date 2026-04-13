import { z } from "zod";

// --- Request translation ---

export const requestTranslationInputSchema = z.object({
  targetLanguage: z.literal("ko"),
});

export type RequestTranslationInput = z.infer<typeof requestTranslationInputSchema>;

// --- Single translation record ---

export const translationRecordSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "processing", "available", "failed"]),
  translatedText: z.string().nullable(),
  translatedPreface: z.string().nullable(),
  translatedAfterword: z.string().nullable(),
  provider: z.string().nullable(),
  modelName: z.string(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  estimatedCostUsd: z.number().nullable(),
});

export type TranslationRecord = z.infer<typeof translationRecordSchema>;

export const translationProgressEstimateSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
  estimatedRemainingMs: z.number().int().nonnegative(),
  estimatedTotalMs: z.number().int().positive(),
  elapsedMs: z.number().int().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  sampleCount: z.number().int().nonnegative(),
});

export const pendingTranslationSchema = z.object({
  status: z.enum(["queued", "processing"]),
  modelName: z.string(),
  progressEstimate: translationProgressEstimateSchema.nullable(),
});

// --- Translation status response (all translations for an episode) ---

export const translationStatusResponseSchema = z.object({
  episodeId: z.string().uuid(),
  targetLanguage: z.literal("ko"),
  // The "active" translation — most recent available, or most recent in-progress/failed
  status: z.enum(["not_requested", "queued", "processing", "available", "failed"]),
  translatedText: z.string().nullable(),
  translatedPreface: z.string().nullable(),
  translatedAfterword: z.string().nullable(),
  provider: z.string().nullable(),
  modelName: z.string().nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  pendingTranslation: pendingTranslationSchema.nullable(),
  // All translations for this episode (for model selection)
  translations: z.array(translationRecordSchema),
});

export type TranslationStatusResponse = z.infer<
  typeof translationStatusResponseSchema
>;

export const discardEpisodeTranslationInputSchema = z.object({
  translationId: z.string().uuid().optional(),
  modelName: z.string().max(200).optional(),
});

export const discardNovelTranslationsInputSchema = z.object({
  modelName: z.string().max(200).optional(),
});

export const discardTranslationsResponseSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
});

export type DiscardEpisodeTranslationInput = z.infer<typeof discardEpisodeTranslationInputSchema>;
export type DiscardNovelTranslationsInput = z.infer<typeof discardNovelTranslationsInputSchema>;
export type DiscardTranslationsResponse = z.infer<typeof discardTranslationsResponseSchema>;
