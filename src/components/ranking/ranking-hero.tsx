"use client";

import { useRouter } from "next/navigation";
import { NovelCover } from "@/components/novel-cover";
import { SourcePill } from "@/components/source-pill";
import { useTranslation } from "@/lib/i18n/client";
import type { SourceSite } from "@/modules/source/domain/source-adapter";

interface RankingHeroItem {
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
  item: RankingHeroItem;
  titleKo?: string;
  onRegister: () => void;
  registering: boolean;
}

export function RankingHero({ item, titleKo, onRegister, registering }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const krTitle = titleKo ?? item.title;

  return (
    <article className="surface-card grid items-center gap-7 rounded-lg p-6 md:grid-cols-[120px_1fr_auto]">
      <NovelCover
        jp={item.title}
        kr={titleKo ?? null}
        width={120}
        height={170}
        rank={item.rank}
        ncode={item.sourceId}
      />
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline gap-3.5 text-muted">
          <span className="text-[28px] font-semibold leading-none text-foreground num-vert tracking-tight">
            N°{item.rank}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.32em]">
            {t("ranking.eyebrow")}
          </span>
          <span className="ml-auto font-mono text-[10px] text-muted">{item.sourceId}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SourcePill site={item.site} variant="full" />
          <span className="text-[12px] text-secondary">{item.authorName}</span>
        </div>

        <h2 className="m-0 flex flex-col gap-1">
          <span className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">
            {krTitle}
          </span>
          {titleKo ? (
            <span className="font-jp text-[14px] leading-tight text-muted">{item.title}</span>
          ) : null}
        </h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          {item.totalEpisodes != null ? (
            <span>
              <strong className="mr-1 font-sans text-[12px] font-semibold normal-case tracking-normal text-foreground">
                {item.totalEpisodes}
              </strong>
              {t("ranking.eps")}
            </span>
          ) : null}
          {item.isCompleted != null ? (
            <>
              <span className="text-border-strong">·</span>
              <span>{item.isCompleted ? t("ranking.completed") : t("ranking.ongoing")}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 self-start">
        {item.novelId ? (
          <button
            type="button"
            onClick={() => router.push(`/novels/${item.novelId}`)}
            className="btn-pill btn-primary text-[12px]"
          >
            {t("ranking.view")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRegister}
            disabled={registering}
            className="btn-pill btn-primary text-[12px]"
          >
            {registering ? "…" : `+ ${t("ranking.register")}`}
          </button>
        )}
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pill btn-secondary text-[12px]"
        >
          {t("novel.viewOnSyosetu")} →
        </a>
      </div>
    </article>
  );
}
