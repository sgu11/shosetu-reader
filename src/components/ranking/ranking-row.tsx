"use client";

import { useRouter } from "next/navigation";
import { NovelCover } from "@/components/novel-cover";
import { SourcePill } from "@/components/source-pill";
import { useTranslation } from "@/lib/i18n/client";
import type { SourceSite } from "@/modules/source/domain/source-adapter";

interface RankingRowItem {
  rank: number;
  site: SourceSite;
  sourceId: string;
  title: string;
  authorName: string;
  totalEpisodes: number | null;
  isCompleted: boolean | null;
  sourceUrl: string;
  novelId: string | null;
}

interface Props {
  item: RankingRowItem;
  titleKo?: string;
  onRegister: () => void;
  registering: boolean;
}

export function RankingRow({ item, titleKo, onRegister, registering }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const krTitle = titleKo ?? item.title;
  const isTopThree = item.rank <= 3;

  return (
    <div className="grid grid-cols-[40px_50px_1fr_auto_auto] items-center gap-4 border-b border-border py-3.5">
      <span
        className={`text-right num-vert text-[18px] leading-none ${
          isTopThree ? "font-semibold text-foreground" : "font-medium text-secondary"
        }`}
      >
        {String(item.rank).padStart(2, "0")}
      </span>
      <NovelCover jp={item.title} kr={titleKo ?? null} width={38} height={54} rank={item.rank} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <SourcePill site={item.site} />
        </div>
        <div className="mt-1 flex flex-col gap-[2px] min-w-0">
          <span className="truncate text-[14px] font-medium leading-tight tracking-tight text-foreground">
            {krTitle}
          </span>
          {titleKo ? (
            <span className="truncate font-jp text-[11px] leading-tight text-muted">
              {item.title}
            </span>
          ) : null}
        </div>
        <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-muted">
          {item.authorName}
          {item.isCompleted != null ? (
            <>
              <span className="mx-1.5 text-border-strong">/</span>
              <span>{item.isCompleted ? t("ranking.completed") : t("ranking.ongoing")}</span>
            </>
          ) : null}
        </div>
      </div>
      <span className="font-mono text-[11px] text-secondary">
        <strong className="font-sans text-[12px] font-semibold text-foreground">
          {item.totalEpisodes ?? "—"}
        </strong>{" "}
        {t("ranking.eps")}
      </span>
      {item.novelId ? (
        <button
          type="button"
          onClick={() => router.push(`/novels/${item.novelId}`)}
          className="rounded-full border border-border-strong px-3 py-1.5 text-[11px] text-secondary transition-colors hover:bg-surface-strong"
        >
          {t("ranking.view")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onRegister}
          disabled={registering}
          className="rounded-full border border-border-strong px-3 py-1.5 text-[11px] text-secondary transition-colors hover:bg-surface-strong disabled:opacity-50"
        >
          {registering ? "…" : `+ ${t("ranking.register")}`}
        </button>
      )}
    </div>
  );
}
