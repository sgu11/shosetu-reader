import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { getLocale, t } from "@/lib/i18n";
import type { ReadingStats } from "@/modules/library/application/get-reading-stats";

interface Props {
  stats: ReadingStats;
  rangeDays: number;
}

function buildSparklinePoints(buckets: { episodes: number }[]): string {
  if (buckets.length === 0) return "0,28 200,28";
  const max = Math.max(1, ...buckets.map((b) => b.episodes));
  const last = buckets.slice(-10);
  const step = last.length > 1 ? 200 / (last.length - 1) : 200;
  return last
    .map((b, i) => {
      const x = i * step;
      const y = 32 - (b.episodes / max) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function totalCost(stats: ReadingStats): number {
  return stats.topModels.reduce((sum, m) => sum + m.costUsd, 0);
}

export async function ReadingStatsCard({ stats, rangeDays }: Props) {
  const locale = await getLocale();
  const cost = totalCost(stats);
  const points = buildSparklinePoints(stats.weeklyBuckets);

  return (
    <aside className="surface-card rounded-lg p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>{t(locale, "home.thisWeek")}</Eyebrow>
        <Link
          href="/stats"
          className="font-mono text-[10px] tracking-wider text-muted hover:text-foreground"
        >
          {t(locale, "home.viewStats")}
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-5">
        <Stat
          value={t(locale, "home.statsHoursValue", { hours: stats.estimatedHoursRead })}
          label={t(locale, "home.statsHours")}
          sub={t(locale, "home.statsHoursSub", { streak: stats.currentStreakDays })}
        />
        <Stat
          value={t(locale, "home.statsEpisodesValue", { count: stats.uniqueEpisodes })}
          label={t(locale, "home.statsEpisodes")}
          sub={t(locale, "home.statsEpisodesSub", { days: rangeDays })}
        />
        <Stat
          value={t(locale, "home.statsCostValue", { cost: cost.toFixed(2) })}
          label={t(locale, "home.statsCost")}
          sub={t(locale, "home.statsCostSub", { models: stats.topModels.length })}
        />
      </div>
      <svg viewBox="0 0 200 36" className="mt-4 h-9 w-full">
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.15}
          strokeWidth={6}
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.4}
        />
      </svg>
    </aside>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div>
      <div className="font-serif text-3xl font-normal leading-none text-foreground">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-secondary">{label}</div>
      <div className="mt-0.5 font-mono text-[9.5px] text-muted">{sub}</div>
    </div>
  );
}
