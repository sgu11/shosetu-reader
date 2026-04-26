import Link from "next/link";
import { MiniProgress } from "@/components/mini-progress";
import { NovelCover } from "@/components/novel-cover";
import { getLocale, t } from "@/lib/i18n";

interface ContinueItem {
  novelId: string;
  episodeId: string;
  episodeNumber: number;
  titleJa: string;
  titleKo: string | null;
  episodeTitle: string | null;
  episodeTitleKo: string | null;
  lastReadAt: string;
}

interface Props {
  item: ContinueItem;
  progress?: number;
}

export async function FeatureCard({ item, progress = 0 }: Props) {
  const locale = await getLocale();
  const krTitle = locale === "ko" && item.titleKo ? item.titleKo : item.titleJa;
  const epTitle =
    locale === "ko" && item.episodeTitleKo ? item.episodeTitleKo : item.episodeTitle;

  return (
    <article className="surface-card flex gap-4 rounded-lg p-4">
      <NovelCover jp={item.titleJa} kr={item.titleKo} width={104} height={148} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="font-mono text-[10px] tracking-wider text-muted">
          {t(locale, "home.nowReading")}
        </div>
        <h3 className="mb-1 mt-1.5 line-clamp-2 font-serif text-[22px] font-medium leading-[1.15] text-foreground">
          {krTitle}
        </h3>
        {locale === "ko" && item.titleKo ? (
          <div className="font-jp text-xs text-muted">{item.titleJa}</div>
        ) : null}
        <div className="flex-1" />
        <div className="mt-3.5">
          <div className="mb-1.5 flex justify-between text-[11px] text-secondary">
            <span className="truncate">
              #{item.episodeNumber}
              {epTitle ? ` — ${epTitle}` : ""}
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <MiniProgress value={progress} />
          <div className="mt-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-muted">
              {new Date(item.lastReadAt).toLocaleDateString()}
            </span>
            <Link
              href={`/reader/${item.episodeId}`}
              className="btn-pill btn-primary !px-3 !py-1.5 text-[11px]"
            >
              {t(locale, "home.continueAction")}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
