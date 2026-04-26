import Link from "next/link";
import { MiniProgress } from "@/components/mini-progress";
import { NovelCover } from "@/components/novel-cover";
import { getLocale } from "@/lib/i18n";

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

export async function SecondaryCard({ item, progress = 0 }: Props) {
  const locale = await getLocale();
  const krTitle = locale === "ko" && item.titleKo ? item.titleKo : item.titleJa;
  const epTitle =
    locale === "ko" && item.episodeTitleKo ? item.episodeTitleKo : item.episodeTitle;

  return (
    <Link
      href={`/reader/${item.episodeId}`}
      className="surface-card flex gap-3 rounded-lg p-3.5 transition-colors hover:bg-surface-strong"
    >
      <NovelCover jp={item.titleJa} kr={item.titleKo} width={56} height={80} />
      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 font-serif text-[14px] font-medium leading-[1.25] text-foreground">
          {krTitle}
        </h4>
        <div className="font-mono text-[9.5px] text-muted">
          #{item.episodeNumber}
          {epTitle ? ` — ${epTitle}` : ""}
        </div>
        <div className="mt-2">
          <MiniProgress value={progress} />
          <div className="mt-1 flex justify-between font-mono text-[9.5px] text-muted">
            <span>{progress}%</span>
            <span>{new Date(item.lastReadAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
