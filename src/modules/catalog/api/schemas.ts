import { z } from "zod";

// --- Novel detail response ---

export const novelResponseSchema = z.object({
  id: z.string().uuid(),
  sourceNcode: z.string(),
  sourceUrl: z.string().url(),
  titleJa: z.string(),
  titleKo: z.string().nullable(),
  titleNormalized: z.string().nullable(),
  authorName: z.string().nullable(),
  summaryJa: z.string().nullable(),
  summaryKo: z.string().nullable(),
  isCompleted: z.boolean().nullable(),
  totalEpisodes: z.number().int().nullable(),
  lastSourceSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NovelResponse = z.infer<typeof novelResponseSchema>;

// --- Episode list item ---

export const episodeListItemSchema = z.object({
  id: z.string().uuid(),
  episodeNumber: z.number().int(),
  titleJa: z.string().nullable(),
  fetchStatus: z.enum(["pending", "fetching", "fetched", "failed"]),
  hasTranslation: z.boolean(),
  translationStatus: z.enum(["queued", "processing", "available", "failed"]).nullable(),
  translationModel: z.string().nullable(),
  publishedAt: z.string().datetime().nullable(),
});

export type EpisodeListItem = z.infer<typeof episodeListItemSchema>;

// --- Episode list response ---

export const episodeListResponseSchema = z.object({
  novelId: z.string().uuid(),
  episodes: z.array(episodeListItemSchema),
  totalCount: z.number().int(),
});

export type EpisodeListResponse = z.infer<typeof episodeListResponseSchema>;
