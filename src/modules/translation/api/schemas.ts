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
  provider: z.string().nullable(),
  modelName: z.string(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type TranslationRecord = z.infer<typeof translationRecordSchema>;

// --- Translation status response (all translations for an episode) ---

export const translationStatusResponseSchema = z.object({
  episodeId: z.string().uuid(),
  targetLanguage: z.literal("ko"),
  // The "active" translation — most recent available, or most recent in-progress/failed
  status: z.enum(["not_requested", "queued", "processing", "available", "failed"]),
  translatedText: z.string().nullable(),
  provider: z.string().nullable(),
  modelName: z.string().nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.string().datetime().nullable(),
  // All translations for this episode (for model selection)
  translations: z.array(translationRecordSchema),
});

export type TranslationStatusResponse = z.infer<
  typeof translationStatusResponseSchema
>;
