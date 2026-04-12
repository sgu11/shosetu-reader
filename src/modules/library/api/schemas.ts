import { z } from "zod";

// --- Library item (subscribed novel with progress) ---

export const libraryItemSchema = z.object({
  novelId: z.string().uuid(),
  titleJa: z.string(),
  titleKo: z.string().nullable(),
  titleNormalized: z.string().nullable(),
  authorName: z.string().nullable(),
  isCompleted: z.boolean().nullable(),
  totalEpisodes: z.number().int().nullable(),
  subscribedAt: z.string().datetime(),
  lastReadAt: z.string().datetime().nullable(),
  currentEpisodeNumber: z.number().int().nullable(),
  currentLanguage: z.enum(["ja", "ko"]).nullable(),
  hasNewEpisodes: z.boolean(),
});

export type LibraryItem = z.infer<typeof libraryItemSchema>;

// --- Library list response ---

export const libraryResponseSchema = z.object({
  items: z.array(libraryItemSchema),
  totalCount: z.number().int(),
});

export type LibraryResponse = z.infer<typeof libraryResponseSchema>;

// --- Update progress input ---

export const updateProgressInputSchema = z.object({
  episodeId: z.string().uuid(),
  language: z.enum(["ja", "ko"]),
  scrollAnchor: z.string().max(500).nullable().optional(),
  progressPercent: z.number().min(0).max(100).nullable().optional(),
});

export type UpdateProgressInput = z.infer<typeof updateProgressInputSchema>;
