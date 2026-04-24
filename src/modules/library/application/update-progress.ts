import { eq, and, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { readingProgress, readingEvents, episodes } from "@/lib/db/schema";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import type { UpdateProgressInput } from "../api/schemas";

const EVENT_DEDUPE_WINDOW_MS = 60_000;

export async function updateReadingProgress(
  input: UpdateProgressInput,
): Promise<void> {
  const userId = await resolveUserId();
  const db = getDb();

  // Look up the episode to get novelId
  const [episode] = await db
    .select({ id: episodes.id, novelId: episodes.novelId })
    .from(episodes)
    .where(eq(episodes.id, input.episodeId))
    .limit(1);

  if (!episode) {
    throw new Error("Episode not found");
  }

  const now = new Date();

  // Upsert reading progress
  await db
    .insert(readingProgress)
    .values({
      userId,
      novelId: episode.novelId,
      currentEpisodeId: input.episodeId,
      currentLanguage: input.language,
      scrollAnchor: input.scrollAnchor ?? null,
      progressPercent: input.progressPercent ?? null,
      lastReadAt: now,
    })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.novelId],
      set: {
        currentEpisodeId: input.episodeId,
        currentLanguage: input.language,
        scrollAnchor: input.scrollAnchor ?? null,
        progressPercent: input.progressPercent ?? null,
        lastReadAt: now,
        updatedAt: now,
      },
    });

  await recordReadingEvent(userId, episode.novelId, input.episodeId, now);
}

async function recordReadingEvent(
  userId: string,
  novelId: string,
  episodeId: string,
  now: Date,
): Promise<void> {
  const db = getDb();
  const windowStart = new Date(now.getTime() - EVENT_DEDUPE_WINDOW_MS);
  const [recent] = await db
    .select({ id: readingEvents.id })
    .from(readingEvents)
    .where(
      and(
        eq(readingEvents.userId, userId),
        eq(readingEvents.episodeId, episodeId),
        gte(readingEvents.createdAt, windowStart),
      ),
    )
    .limit(1);

  if (recent) return;

  await db
    .insert(readingEvents)
    .values({
      userId,
      novelId,
      episodeId,
      eventKind: "opened",
      createdAt: now,
    })
    .onConflictDoNothing();
}
