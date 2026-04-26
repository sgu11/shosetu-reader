"use client";

import { useRouter } from "next/navigation";
import { NovelCover } from "@/components/novel-cover";
import { useTranslation } from "@/lib/i18n/client";

interface RankingItem {
  rank: number;
  ncode: string;
  title: string;
  authorName: string;
  totalEpisodes: number;
  isCompleted: boolean;
  sourceUrl: string;
  novelId: string | null;
}

interface Props {
  item: RankingItem;
  titleKo?: string;
  onRegister: (ncode: string) => void;
  registering: boolean;
}

export function RankingHero({ item, titleKo, onRegister, registering }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const krTitle = titleKo ?? item.title;

  return (
    <article className="surface-card grid items-center gap-5 rounded-lg p-5 md:grid-cols-[120px_1fr_auto]">
      <NovelCover jp={item.title} kr={titleKo ?? null} width={120} height={170} />
      <div>
        <div className="flex items-center gap-3">
          <span className="font-serif text-5xl font-normal italic leading-none text-accent">
            №{item.rank}
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {item.ncode} · {item.totalEpisodes} {t("ranking.eps")}
            </div>
            <h2 className="m-0 font-serif text-2xl font-medium leading-tight text-foreground md:text-3xl">
              {krTitle}
            </h2>
            {titleKo ? (
              <div className="font-jp text-sm text-secondary">{item.title}</div>
            ) : null}
            <div className="mt-0.5 font-jp text-xs text-muted">{item.authorName}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
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
            onClick={() => onRegister(item.ncode)}
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
