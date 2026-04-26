import { Eyebrow } from "@/components/eyebrow";
import { FeatureCard } from "@/components/home/feature-card";
import { HomeHero } from "@/components/home/home-hero";
import { ReadingStatsCard } from "@/components/home/reading-stats-card";
import { SecondaryCard } from "@/components/home/secondary-card";
import { getLocale, t } from "@/lib/i18n";
import { getContinueReading } from "@/modules/library/application/get-library";
import {
  getReadingStats,
  type ReadingStats,
} from "@/modules/library/application/get-reading-stats";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";

const RANGE_DAYS = 30;

const EMPTY_STATS: ReadingStats = {
  range: "30d",
  totalEpisodesRead: 0,
  uniqueEpisodes: 0,
  estimatedHoursRead: 0,
  currentStreakDays: 0,
  longestStreakDays: 0,
  weeklyBuckets: [],
  topModels: [],
  perNovel: [],
};

export default async function Home() {
  const locale = await getLocale();

  let continueItems: Awaited<ReturnType<typeof getContinueReading>> = [];
  let stats: ReadingStats = EMPTY_STATS;

  try {
    [continueItems, stats] = await Promise.all([
      getContinueReading(),
      resolveUserId().then((uid) => getReadingStats(uid, "30d")),
    ]);
  } catch {
    // DB not ready — render empty state
  }

  const top = continueItems[0];
  const continueTop = top
    ? {
        novelId: top.novelId,
        episodeId: top.episodeId,
        episodeNumber: top.episodeNumber,
        titleJa: top.titleJa,
        titleKo: top.titleKo,
      }
    : undefined;

  return (
    <main className="frame-paper paper-grain flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 px-2 md:grid-cols-[1.4fr_1fr] md:items-end md:gap-10 md:px-0">
          <HomeHero continueTop={continueTop} />
          <div className="px-14 pb-7 md:px-0 md:pr-14">
            <ReadingStatsCard stats={stats} rangeDays={RANGE_DAYS} />
          </div>
        </div>

        {continueItems.length > 0 ? (
          <section className="border-t border-border px-14 py-7">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="m-0 font-serif text-2xl font-normal italic text-foreground">
                {t(locale, "home.continueReading")}
              </h2>
              <span className="font-mono text-[10px] tracking-wider text-muted">
                {t(locale, "home.bookCount", { count: continueItems.length })}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-[1.6fr_1fr_1fr]">
              {continueItems[0] ? (
                <FeatureCard item={continueItems[0]} progress={0} />
              ) : (
                <div />
              )}
              <div className="flex flex-col gap-3.5">
                {continueItems[1] ? (
                  <SecondaryCard item={continueItems[1]} progress={0} />
                ) : null}
                {continueItems[2] ? (
                  <SecondaryCard item={continueItems[2]} progress={0} />
                ) : null}
              </div>
              <div className="flex flex-col gap-3.5">
                {continueItems[3] ? (
                  <SecondaryCard item={continueItems[3]} progress={0} />
                ) : null}
                {continueItems[4] ? (
                  <SecondaryCard item={continueItems[4]} progress={0} />
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="border-t border-border px-14 py-10 text-center">
            <Eyebrow>{t(locale, "library.empty")}</Eyebrow>
          </section>
        )}
      </div>
    </main>
  );
}
