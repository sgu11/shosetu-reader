import { z } from "zod";
import { pendingTranslationSchema } from "@/modules/translation/api/schemas";

// --- Reader payload — the main response for the reading screen ---

export const readerPayloadSchema = z.object({
  novel: z.object({
    id: z.string().uuid(),
    titleJa: z.string(),
    titleNormalized: z.string().nullable(),
    sourceNcode: z.string(),
  }),
  episode: z.object({
    id: z.string().uuid(),
    episodeNumber: z.number().int(),
    titleJa: z.string().nullable(),
    titleKo: z.string().nullable(),
    sourceTextJa: z.string().nullable(),
    prefaceJa: z.string().nullable(),
    afterwordJa: z.string().nullable(),
  }),
  translation: z
    .object({
      status: z.enum(["queued", "processing", "available", "failed"]),
      translatedText: z.string().nullable(),
      translatedPreface: z.string().nullable(),
      translatedAfterword: z.string().nullable(),
      provider: z.string().nullable(),
      modelName: z.string().nullable(),
      errorMessage: z.string().nullable(),
      hasWarnings: z.boolean(),
    })
    .nullable(),
  translations: z.array(
    z.object({
      id: z.string().uuid(),
      modelName: z.string(),
      completedAt: z.string().nullable(),
      estimatedCostUsd: z.number().nullable(),
    }),
  ),
  pendingTranslation: pendingTranslationSchema.nullable(),
  configuredModel: z.string(),
  navigation: z.object({
    prevEpisodeId: z.string().uuid().nullable(),
    nextEpisodeId: z.string().uuid().nullable(),
  }),
  progress: z
    .object({
      currentLanguage: z.enum(["ja", "ko"]),
      scrollAnchor: z.string().nullable(),
      progressPercent: z.number().nullable(),
    })
    .nullable(),
});

export type ReaderPayload = z.infer<typeof readerPayloadSchema>;
