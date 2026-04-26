import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { readingEvents } from "@/lib/db/schema/library";
import { novels } from "@/lib/db/schema/novels";
import { translations } from "@/lib/db/schema/translations";
import { episodes } from "@/lib/db/schema/episodes";

export type Range = "7d" | "30d" | "90d" | "all";

export interface WeeklyBucket {
  weekStart: string;
  episodes: number;
}

export interface TopModelRow {
  modelName: string;
  episodesRead: number;
  costUsd: number;
}

export interface PerNovelRow {
  novelId: string;
  titleJa: string;
  titleKo: string | null;
  episodesRead: number;
  lastReadAt: string;
}

export interface ReadingStats {
  range: Range;
  totalEpisodesRead: number;
  uniqueEpisodes: number;
  estimatedHoursRead: number;
  currentStreakDays: number;
  longestStreakDays: number;
  weeklyBuckets: WeeklyBucket[];
  topModels: TopModelRow[];
  perNovel: PerNovelRow[];
}

function rangeStart(range: Range): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function computeStreaks(days: string[]): { current: number; longest: number } {
  if (days.length === 0) return { current: 0, longest: 0 };
  const set = new Set(days);
  let longest = 0;
  let current = 0;
  const sorted = [...set].sort();
  let run = 0;
  let prev: Date | null = null;
  for (const iso of sorted) {
    const d = new Date(iso + "T00:00:00Z");
    if (prev && d.getTime() - prev.getTime() === 86_400_000) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; ; i += 1) {
    const check = new Date(today);
    check.setUTCDate(today.getUTCDate() - i);
    const iso = check.toISOString().slice(0, 10);
    if (set.has(iso)) {
      current += 1;
    } else {
      break;
    }
  }

  return { current, longest };
}

export async function getReadingStats(
  userId: string,
  range: Range = "90d",
): Promise<ReadingStats> {
  const db = getDb();
  const start = rangeStart(range);

  const eventFilters = [eq(readingEvents.userId, userId)];
  if (start) eventFilters.push(gte(readingEvents.createdAt, start));

  const weekExpr = sql<string>`date_trunc('week', ${readingEvents.createdAt})`;
  const weekly = await db
    .select({
      week: weekExpr,
      count: sql<number>`count(distinct ${readingEvents.episodeId})::int`,
    })
    .from(readingEvents)
    .where(and(...eventFilters))
    .groupBy(weekExpr)
    .orderBy(weekExpr);

  const weeklyBuckets: WeeklyBucket[] = weekly.map((row) => ({
    weekStart: new Date(row.week).toISOString().slice(0, 10),
    episodes: Number(row.count),
  }));

  const dayExpr = sql<string>`to_char(date_trunc('day', ${readingEvents.createdAt}), 'YYYY-MM-DD')`;
  const dayRows = await db
    .selectDistinct({ day: dayExpr })
    .from(readingEvents)
    .where(and(...eventFilters));
  const streak = computeStreaks(dayRows.map((r) => r.day));

  const totalRow = await db
    .select({
      total: sql<number>`count(*)::int`,
      uniq: sql<number>`count(distinct ${readingEvents.episodeId})::int`,
    })
    .from(readingEvents)
    .where(and(...eventFilters));
  const total = totalRow[0]?.total ?? 0;
  const uniqueEpisodes = totalRow[0]?.uniq ?? 0;

  const perNovelRows = await db
    .select({
      novelId: readingEvents.novelId,
      titleJa: novels.titleJa,
      titleKo: novels.titleKo,
      episodesRead: sql<number>`count(distinct ${readingEvents.episodeId})::int`,
      lastReadAt: sql<Date>`max(${readingEvents.createdAt})`,
    })
    .from(readingEvents)
    .innerJoin(novels, eq(readingEvents.novelId, novels.id))
    .where(and(...eventFilters))
    .groupBy(readingEvents.novelId, novels.titleJa, novels.titleKo)
    .orderBy(desc(sql`max(${readingEvents.createdAt})`))
    .limit(20);

  const perNovel: PerNovelRow[] = perNovelRows.map((row) => ({
    novelId: row.novelId,
    titleJa: row.titleJa ?? "",
    titleKo: row.titleKo,
    episodesRead: Number(row.episodesRead),
    lastReadAt: new Date(row.lastReadAt).toISOString(),
  }));

  // Dedup at (episode, model) granularity so SUM is unconditional. Using
  // row_number() over (partition ...) lets us pick the most recent translation
  // per pair even when isCanonical is not set on legacy rows.
  const rankedTranslations = db
    .select({
      episodeId: translations.episodeId,
      modelName: translations.modelName,
      estimatedCostUsd: translations.estimatedCostUsd,
      rn: sql<number>`row_number() over (partition by ${translations.episodeId}, ${translations.modelName} order by ${translations.createdAt} desc)`.as("rn"),
    })
    .from(translations)
    .where(eq(translations.status, "available"))
    .as("ranked_translations");

  const modelRows = await db
    .select({
      modelName: rankedTranslations.modelName,
      episodes: sql<number>`count(distinct ${readingEvents.episodeId})::int`,
      cost: sql<number>`coalesce(sum(${rankedTranslations.estimatedCostUsd}), 0)::float`,
    })
    .from(readingEvents)
    .innerJoin(episodes, eq(readingEvents.episodeId, episodes.id))
    .innerJoin(
      rankedTranslations,
      and(
        eq(rankedTranslations.episodeId, episodes.id),
        eq(rankedTranslations.rn, 1),
      ),
    )
    .where(and(...eventFilters))
    .groupBy(rankedTranslations.modelName)
    .orderBy(desc(sql`count(distinct ${readingEvents.episodeId})`))
    .limit(10);

  const topModels: TopModelRow[] = modelRows.map((row) => ({
    modelName: row.modelName,
    episodesRead: Number(row.episodes),
    costUsd: Number(row.cost),
  }));

  // Cheap reading-time estimate: assume ~4 minutes per episode.
  // DB has no per-event duration; this is good enough until we track time.
  const estimatedHoursRead = Math.round((uniqueEpisodes * 4) / 60 * 10) / 10;

  return {
    range,
    totalEpisodesRead: total,
    uniqueEpisodes,
    estimatedHoursRead,
    currentStreakDays: streak.current,
    longestStreakDays: streak.longest,
    weeklyBuckets,
    topModels,
    perNovel,
  };
}
