import { describe, expect, it } from "vitest";
import { readerPayloadSchema } from "@/modules/reader/api/schemas";

describe("readerPayloadSchema", () => {
  it("accepts progress and pending translation metadata", () => {
    const result = readerPayloadSchema.safeParse({
      novel: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        titleJa: "テスト小説",
        titleNormalized: null,
        sourceNcode: "n1234ab",
      },
      episode: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        episodeNumber: 12,
        titleJa: "第12話",
        titleKo: "12화",
        sourceTextJa: "本文",
        prefaceJa: null,
        afterwordJa: null,
      },
      translation: {
        status: "available",
        translatedText: "번역문",
        translatedPreface: null,
        translatedAfterword: null,
        provider: "openrouter",
        modelName: "google/gemini-2.5-flash-lite",
        errorMessage: null,
        hasWarnings: false,
      },
      translations: [
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          modelName: "google/gemini-2.5-flash-lite",
          completedAt: "2026-04-11T01:00:00.000Z",
          estimatedCostUsd: 0.0008,
        },
      ],
      pendingTranslation: {
        status: "processing",
        modelName: "openai/gpt-4.1-mini",
        progressEstimate: {
          progressPercent: 42,
          estimatedRemainingMs: 12000,
          estimatedTotalMs: 20000,
          elapsedMs: 8000,
          confidence: "medium",
          sampleCount: 6,
        },
      },
      configuredModel: "openai/gpt-4.1-mini",
      navigation: {
        prevEpisodeId: null,
        nextEpisodeId: "550e8400-e29b-41d4-a716-446655440003",
      },
      progress: {
        currentLanguage: "ko",
        scrollAnchor: "p-12",
        progressPercent: 48,
      },
    });

    expect(result.success).toBe(true);
  });
});
