import { notFound } from "next/navigation";
import { getNovelById, getEpisodesByNovelId } from "@/modules/catalog/application/get-novel";
import { isSubscribed } from "@/modules/library/application/subscribe";
import Link from "next/link";
import { IngestButton } from "@/components/ingest-button";
import { SubscribeButton } from "@/components/subscribe-button";
import { NovelPromptEditor } from "@/components/novel-prompt-editor";
import { getLocale, t } from "@/lib/i18n";

interface Props {
  params: Promise<{ novelId: string }>;
}

export default async function NovelDetailPage({ params }: Props) {
  const locale = await getLocale();
  const { novelId } = await params;
  const novel = await getNovelById(novelId);

  if (!novel) {
    notFound();
  }

  const { episodes, totalCount } = await getEpisodesByNovelId(novelId);

  let subscribed = false;
  try {
    subscribed = await isSubscribed(novelId);
  } catch {
    // DB not ready — default to unsubscribed
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Back link */}
      <Link
        href="/library"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; {t(locale, "novel.backToLibrary")}
      </Link>

      {/* Novel header */}
      <section className="surface-card space-y-5 rounded-xl p-7">
        <div className="flex items-center gap-3">
          <span className="code-label">
            {novel.sourceNcode}
          </span>
          {novel.isCompleted != null && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                novel.isCompleted
                  ? "bg-success/10 text-success"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {novel.isCompleted ? t(locale, "novel.completed") : t(locale, "novel.ongoing")}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {locale === "ko" && novel.titleKo ? novel.titleKo : novel.titleJa}
        </h1>
        {locale === "ko" && novel.titleKo && (
          <p className="text-sm text-muted/60">{novel.titleJa}</p>
        )}

        {novel.authorName && (
          <p className="text-sm text-muted">{t(locale, "novel.by")} {novel.authorName}</p>
        )}

        {(novel.summaryJa || novel.summaryKo) && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-5 text-sm leading-8 text-muted">
            {locale === "ko" && novel.summaryKo ? novel.summaryKo : novel.summaryJa}
          </div>
        )}

        <div className="flex items-center gap-6 text-sm text-muted">
          {novel.totalEpisodes != null && (
            <span>{novel.totalEpisodes} {t(locale, "novel.episodes")}</span>
          )}
          {novel.lastSourceSyncAt && (
            <span>
              {t(locale, "novel.synced")}{" "}
              {new Date(novel.lastSourceSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a
            href={novel.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            {t(locale, "novel.viewOnSyosetu")} &rarr;
          </a>
        </div>

        <div className="flex items-center gap-3">
          <SubscribeButton novelId={novelId} initialSubscribed={subscribed} />
          <IngestButton novelId={novelId} />
        </div>
      </section>

      {/* Per-novel translation prompt */}
      <NovelPromptEditor novelId={novelId} />

      {/* Episode list */}
      <section className="space-y-4">
        <h2 className="text-xl font-normal">
          {t(locale, "novel.episodesHeading")}{" "}
          <span className="text-base text-muted">
            ({totalCount})
          </span>
        </h2>

        {episodes.length === 0 ? (
          <div className="surface-card rounded-xl p-7 text-center text-sm text-muted">
            {t(locale, "novel.noEpisodes")}
          </div>
        ) : (
          <div className="space-y-1">
            {episodes.map((ep) => {
              const isReadable = ep.fetchStatus === "fetched";
              const inner = (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted">
                      #{ep.episodeNumber}
                    </span>
                    <span className="text-sm">
                      {ep.titleJa ?? `Episode ${ep.episodeNumber}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {ep.translationStatus === "available" ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success" title={ep.translationModel ?? undefined}>
                        KR
                      </span>
                    ) : ep.translationStatus === "queued" || ep.translationStatus === "processing" ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        {ep.translationStatus === "queued" ? "queued" : "translating"}
                      </span>
                    ) : ep.translationStatus === "failed" ? (
                      <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs text-error">
                        failed
                      </span>
                    ) : null}
                    {ep.translationModel && ep.translationStatus === "available" && (
                      <span className="text-xs text-muted">
                        {ep.translationModel.split("/").pop()}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        ep.fetchStatus === "fetched"
                          ? "bg-success/10 text-success"
                          : ep.fetchStatus === "failed"
                            ? "bg-error/10 text-error"
                            : "bg-surface-strong text-muted"
                      }`}
                    >
                      {ep.fetchStatus}
                    </span>
                  </div>
                </>
              );

              return isReadable ? (
                <Link
                  key={ep.id}
                  href={`/reader/${ep.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-3 transition-colors hover:border-border-strong hover:bg-surface-strong"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={ep.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-3"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
