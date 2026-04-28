import Link from "next/link";

interface TocEntry {
  id: string;
  episodeNumber: number;
  titleJa: string | null;
  titleKo: string | null;
}

interface Props {
  entries: TocEntry[];
  currentEpisodeId: string;
  totalEpisodes: number | null;
  novelTitleJa: string;
  novelTitleKo: string | null;
  novelId: string;
  currentEpisodeNumber: number;
}

export function ReaderTocSidebar({
  entries,
  currentEpisodeId,
  totalEpisodes,
  novelTitleJa,
  novelTitleKo,
  novelId,
  currentEpisodeNumber,
}: Props) {
  const total = totalEpisodes ?? entries.at(-1)?.episodeNumber ?? currentEpisodeNumber;
  const pct = total > 0 ? Math.round((currentEpisodeNumber / total) * 100) : 0;

  return (
    <aside className="hidden flex-col gap-5 font-mono text-[10.5px] uppercase tracking-wide text-muted lg:flex">
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/novels/${novelId}`}
          className="text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-foreground"
        >
          ← Library
        </Link>
        {novelTitleKo ? (
          <span className="font-sans text-[14px] font-medium normal-case tracking-tight text-foreground">
            {novelTitleKo}
          </span>
        ) : null}
        <span className="font-jp text-[11.5px] normal-case tracking-normal text-muted">
          {novelTitleJa}
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-wider">
          <span>
            #{currentEpisodeNumber} / {total}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-foreground"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>

      <nav
        className="flex flex-col border-t border-border pt-2"
        aria-label="table of contents"
      >
        {entries.map((e) => {
          const active = e.id === currentEpisodeId;
          return (
            <Link
              key={e.id}
              href={`/reader/${e.id}`}
              className={`grid grid-cols-[28px_1fr] gap-2.5 border-b border-border py-2 normal-case ${
                active ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span
                className={`font-mono text-[10px] tracking-wider ${
                  active ? "text-foreground" : "text-muted/80"
                }`}
              >
                {String(e.episodeNumber).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col">
                {e.titleKo ? (
                  <span
                    className={`truncate font-sans text-[12.5px] tracking-tight ${
                      active
                        ? "font-medium text-foreground"
                        : "text-secondary"
                    }`}
                  >
                    {e.titleKo}
                  </span>
                ) : null}
                {e.titleJa ? (
                  <span className="truncate font-jp text-[10px] text-muted">
                    {e.titleJa}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
