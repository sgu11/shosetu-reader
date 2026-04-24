import Link from "next/link";
import { resolveUserId } from "@/modules/identity/application/resolve-user-context";
import {
  getReadingStats,
  type Range,
  type WeeklyBucket,
  type TopModelRow,
  type PerNovelRow,
} from "@/modules/library/application/get-reading-stats";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

function coerceRange(raw: string | undefined): Range {
  if (raw === "30d" || raw === "90d" || raw === "all") return raw;
  return "90d";
}

export default async function StatsPage({ searchParams }: Props) {
  const { range: rangeRaw } = await searchParams;
  const range = coerceRange(rangeRaw);

  const userId = await resolveUserId();
  const stats = await getReadingStats(userId, range);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <Link href="/library" className="text-sm text-muted hover:text-foreground">
        &larr; Library
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal tracking-tight">Reading stats</h1>
          <p className="text-sm text-muted">
            {stats.totalEpisodesRead} episode opens · {stats.uniqueEpisodes} unique
            episodes · timestamps in UTC
          </p>
        </div>
        <nav className="flex gap-1 text-xs">
          {(["30d", "90d", "all"] as const).map((r) => (
            <Link
              key={r}
              href={`/stats?range=${r}`}
              className={`rounded-full px-3 py-1.5 ${
                range === r
                  ? "bg-foreground text-background"
                  : "bg-surface-strong text-muted hover:text-foreground"
              }`}
            >
              {r}
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="episodes read" value={String(stats.uniqueEpisodes)} />
        <StatTile label="current streak" value={`${stats.currentStreakDays}d`} />
        <StatTile label="longest streak" value={`${stats.longestStreakDays}d`} />
        <StatTile label="novels touched" value={String(stats.perNovel.length)} />
      </section>

      <WeeklyChart buckets={stats.weeklyBuckets} />

      <TopModelsTable rows={stats.topModels} />

      <PerNovelList rows={stats.perNovel} />
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="text-2xl font-medium">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function WeeklyChart({ buckets }: { buckets: WeeklyBucket[] }) {
  if (buckets.length === 0) {
    return (
      <section className="surface-card rounded-xl p-5">
        <h2 className="text-sm font-medium text-muted">Weekly activity</h2>
        <p className="mt-2 text-sm text-muted">No reading events yet.</p>
      </section>
    );
  }
  const max = Math.max(...buckets.map((b) => b.episodes), 1);
  const barWidth = 20;
  const gap = 6;
  const height = 120;
  const width = buckets.length * (barWidth + gap);
  return (
    <section className="surface-card space-y-3 rounded-xl p-5">
      <h2 className="text-sm font-medium text-muted">Weekly activity</h2>
      <div className="overflow-x-auto">
        <svg width={width} height={height + 24} className="text-accent">
          {buckets.map((b, i) => {
            const h = (b.episodes / max) * height;
            return (
              <g key={b.weekStart}>
                <rect
                  x={i * (barWidth + gap)}
                  y={height - h}
                  width={barWidth}
                  height={h}
                  fill="currentColor"
                  rx={2}
                >
                  <title>
                    {b.weekStart}: {b.episodes} episodes
                  </title>
                </rect>
                <text
                  x={i * (barWidth + gap) + barWidth / 2}
                  y={height + 14}
                  textAnchor="middle"
                  className="fill-current text-muted"
                  style={{ fontSize: 9 }}
                >
                  {b.weekStart.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function TopModelsTable({ rows }: { rows: TopModelRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="surface-card space-y-2 rounded-xl p-5">
      <h2 className="text-sm font-medium text-muted">Top models (by episodes read)</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">Model</th>
            <th className="py-1 text-right">Episodes</th>
            <th className="py-1 text-right">Cost (USD)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.modelName}>
              <td className="py-1.5">
                <span className="font-mono text-xs" title={r.modelName}>
                  {r.modelName.split("/").pop()}
                </span>
              </td>
              <td className="py-1.5 text-right">{r.episodesRead}</td>
              <td className="py-1.5 text-right">${r.costUsd.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PerNovelList({ rows }: { rows: PerNovelRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="surface-card space-y-2 rounded-xl p-5">
      <h2 className="text-sm font-medium text-muted">Novels read</h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.novelId} className="flex items-center justify-between py-2">
            <Link
              href={`/novels/${r.novelId}`}
              className="truncate text-sm hover:text-accent"
            >
              {r.titleKo ?? r.titleJa}
            </Link>
            <span className="font-mono text-xs text-muted">{r.episodesRead}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
