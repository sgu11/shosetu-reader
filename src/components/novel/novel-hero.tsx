import { NovelCover } from "@/components/novel-cover";
import { SubscribeButton } from "@/components/subscribe-button";
import { getLocale, t } from "@/lib/i18n";

interface NovelHeroProps {
  novelId: string;
  novel: {
    titleJa: string;
    titleKo: string | null;
    sourceNcode: string;
    authorName: string | null;
    summaryJa: string | null;
    summaryKo: string | null;
    isCompleted: boolean | null;
    sourceUrl: string;
  };
  subscribed: boolean;
}

export async function NovelHero({ novelId, novel, subscribed }: NovelHeroProps) {
  const locale = await getLocale();
  const krTitle = locale === "ko" && novel.titleKo ? novel.titleKo : novel.titleJa;
  const summary = locale === "ko" && novel.summaryKo ? novel.summaryKo : novel.summaryJa;

  return (
    <section className="grid items-end gap-8 md:grid-cols-[180px_1fr_auto]">
      <NovelCover jp={novel.titleJa} kr={novel.titleKo} width={180} height={252} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span>{novel.sourceNcode}</span>
          {novel.isCompleted != null ? (
            <span>· {novel.isCompleted ? t(locale, "novel.completed") : t(locale, "novel.ongoing")}</span>
          ) : null}
          {subscribed ? <span>· {t(locale, "novel.subscribed")}</span> : null}
        </div>
        <h1 className="mt-2 mb-1 font-serif text-4xl font-normal leading-[1.05] tracking-tight text-foreground md:text-5xl">
          {krTitle}
        </h1>
        {locale === "ko" && novel.titleKo ? (
          <div className="mb-3 font-jp text-lg text-secondary">{novel.titleJa}</div>
        ) : null}
        {novel.authorName ? (
          <div className="mb-3 font-jp text-sm text-muted">
            {t(locale, "novel.by")} {novel.authorName}
          </div>
        ) : null}
        {summary ? (
          <p className="m-0 max-w-[560px] font-serif text-[14.5px] leading-relaxed text-secondary">
            {summary}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-[180px] flex-col gap-2">
        <SubscribeButton novelId={novelId} initialSubscribed={subscribed} />
        <a
          href={novel.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-pill btn-secondary text-[12px]"
        >
          {t(locale, "novel.viewOnSyosetu")} →
        </a>
      </div>
    </section>
  );
}
