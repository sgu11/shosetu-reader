import Link from "next/link";
import { MiniProgress } from "@/components/mini-progress";
import { NovelCover } from "@/components/novel-cover";
import { StatusPill } from "@/components/status-pill";
import { getLocale, t } from "@/lib/i18n";
import type { LibraryItem } from "@/modules/library/api/schemas";

interface Props {
  item: LibraryItem;
}

function deriveStatus(item: LibraryItem): { kind: "done" | "queued"; label: string } {
  const { fetchedEpisodes, translatedEpisodes, activeTranslations } = item.statusOverview;
  if (activeTranslations > 0) {
    return { kind: "queued", label: "queued" };
  }
  if (fetchedEpisodes > 0 && translatedEpisodes >= fetchedEpisodes) {
    return { kind: "done", label: "done" };
  }
  return { kind: "queued", label: "pending" };
}

export async function ShelfCard({ item }: Props) {
  const locale = await getLocale();
  const krTitle = locale === "ko" && item.titleKo ? item.titleKo : item.titleJa;
  const total = item.totalEpisodes ?? item.statusOverview.fetchedEpisodes;
  const read = item.currentEpisodeNumber ?? 0;
  const status = deriveStatus(item);
  const statusLabel =
    status.kind === "done"
      ? t(locale, "library.statusDone")
      : status.label === "queued"
        ? t(locale, "library.statusQueued")
        : t(locale, "library.statusPending");

  const updatedDate = item.lastReadAt
    ? new Date(item.lastReadAt).toLocaleDateString()
    : new Date(item.subscribedAt).toLocaleDateString();

  return (
    <Link
      href={`/novels/${item.novelId}`}
      className="surface-card relative flex flex-col gap-3 rounded-lg p-4 transition-colors hover:bg-surface-strong"
    >
      {item.hasNewEpisodes ? (
        <span className="absolute -top-1.5 right-3.5 rounded-full bg-accent px-2 py-[3px] font-mono text-[9.5px] font-semibold tracking-wider text-accent-contrast">
          {t(locale, "library.newBadge")}
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <NovelCover jp={item.titleJa} kr={item.titleKo} width={80} height={112} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-3 font-serif text-[15px] font-medium leading-tight text-foreground">
            {krTitle}
          </h3>
          {item.authorName ? (
            <div className="mt-1 font-jp text-[10px] text-muted">
              {item.authorName}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between font-mono text-[10.5px] text-secondary">
          <span>
            {read}/{total ?? "—"} {t(locale, "library.eps")}
          </span>
          <span>
            {total && total > 0 ? Math.round((read / total) * 100) : 0}%
          </span>
        </div>
        <MiniProgress value={read} max={total ?? 1} />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <StatusPill kind={status.kind} label={statusLabel} />
        <span className="font-mono text-[9.5px] text-muted">{updatedDate}</span>
      </div>
    </Link>
  );
}
