import { describe, expect, it } from "vitest";
import {
  requestTranslationInputSchema,
  translationStatusResponseSchema,
} from "@/modules/translation/api/schemas";

describe("requestTranslationInputSchema", () => {
  it("accepts ko as target language", () => {
    const result = requestTranslationInputSchema.safeParse({
      targetLanguage: "ko",
    });
    expect(result.success).toBe(true);
  });

  it("rejects other languages", () => {
    const result = requestTranslationInputSchema.safeParse({
      targetLanguage: "en",
    });
    expect(result.success).toBe(false);
  });
});

describe("translationStatusResponseSchema", () => {
  it("validates a complete available response", () => {
    const result = translationStatusResponseSchema.safeParse({
      episodeId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguage: "ko",
      status: "available",
      translatedText: "번역된 텍스트",
      translatedPreface: null,
      translatedAfterword: null,
      provider: "openrouter",
      modelName: "gpt-4o",
      errorMessage: null,
      completedAt: "2026-04-10T12:00:00.000Z",
      pendingTranslation: {
        status: "processing",
        modelName: "gpt-4.1-mini",
        progressEstimate: {
          progressPercent: 42,
          estimatedRemainingMs: 12000,
          estimatedTotalMs: 20000,
          elapsedMs: 8000,
          confidence: "medium",
          sampleCount: 6,
        },
      },
      translations: [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          status: "available",
          translatedText: "번역된 텍스트",
          translatedPreface: null,
          translatedAfterword: null,
          provider: "openrouter",
          modelName: "gpt-4o",
          errorMessage: null,
          completedAt: "2026-04-10T12:00:00.000Z",
          estimatedCostUsd: 0.0015,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates a not_requested response", () => {
    const result = translationStatusResponseSchema.safeParse({
      episodeId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguage: "ko",
      status: "not_requested",
      translatedText: null,
      translatedPreface: null,
      translatedAfterword: null,
      provider: null,
      modelName: null,
      errorMessage: null,
      completedAt: null,
      pendingTranslation: null,
      translations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = translationStatusResponseSchema.safeParse({
      episodeId: "550e8400-e29b-41d4-a716-446655440000",
      targetLanguage: "ko",
      status: "unknown",
      translatedText: null,
      translatedPreface: null,
      translatedAfterword: null,
      provider: null,
      modelName: null,
      errorMessage: null,
      completedAt: null,
      pendingTranslation: null,
      translations: [],
    });
    expect(result.success).toBe(false);
  });
});
