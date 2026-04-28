import Link from "next/link";

interface Props {
  novelId: string;
  novelTitleJa: string;
  novelTitleKo: string | null;
  currentEpisodeNumber: number;
  totalEpisodes: number | null;
}

export function ReaderProgressBar({
  novelId,
  novelTitleJa,
  novelTitleKo,
  currentEpisodeNumber,
  totalEpisodes,
}: Props) {
  const total = totalEpisodes ?? currentEpisodeNumber;
  const pct = total > 0 ? Math.round((currentEpisodeNumber / total) * 100) : 0;
  const fillPct = Math.max(0, Math.min(100, pct));

  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-6 pt-3 pb-2 lg:px-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Link
            href={`/novels/${novelId}`}
            className="flex min-w-0 items-baseline gap-2 truncate text-secondary transition-colors hover:text-foreground"
          >
            <span aria-hidden className="text-[12px]">
              ←
            </span>
            <span className="truncate text-[14px] font-medium tracking-tight text-foreground">
              {novelTitleKo ?? novelTitleJa}
            </span>
            {novelTitleKo ? (
              <span className="truncate font-jp text-[11.5px] text-muted">
                {novelTitleJa}
              </span>
            ) : null}
          </Link>
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            #{currentEpisodeNumber} / {total} · {pct}%
          </span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-foreground transition-[width]"
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
