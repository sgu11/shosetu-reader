import { notFound } from "next/navigation";
import { getNovelById, getEpisodesByNovelId } from "@/modules/catalog/application/get-novel";
import Link from "next/link";
import { IngestButton } from "@/components/ingest-button";

interface Props {
  params: Promise<{ novelId: string }>;
}

export default async function NovelDetailPage({ params }: Props) {
  const { novelId } = await params;
  const novel = await getNovelById(novelId);

  if (!novel) {
    notFound();
  }

  const { episodes, totalCount } = await getEpisodesByNovelId(novelId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Back link */}
      <Link
        href="/register"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; Back to register
      </Link>

      {/* Novel header */}
      <section className="surface-card space-y-5 rounded-2xl p-7">
        <div className="flex items-center gap-3">
          <span className="rounded-full border hairline px-3 py-1 text-xs font-medium text-muted">
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
              {novel.isCompleted ? "Completed" : "Ongoing"}
            </span>
          )}
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">
          {novel.titleJa}
        </h1>

        {novel.authorName && (
          <p className="text-sm text-muted">by {novel.authorName}</p>
        )}

        {novel.summaryJa && (
          <div className="reader-text max-h-48 overflow-y-auto rounded-xl border hairline bg-background/60 p-5 text-sm leading-8 text-muted">
            {novel.summaryJa}
          </div>
        )}

        <div className="flex items-center gap-6 text-sm text-muted">
          {novel.totalEpisodes != null && (
            <span>{novel.totalEpisodes} episodes</span>
          )}
          {novel.lastSourceSyncAt && (
            <span>
              Synced{" "}
              {new Date(novel.lastSourceSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <a
            href={novel.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            View on Syosetu &rarr;
          </a>
        </div>

        <IngestButton novelId={novelId} />
      </section>

      {/* Episode list */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Episodes{" "}
          <span className="text-base font-normal text-muted">
            ({totalCount})
          </span>
        </h2>

        {episodes.length === 0 ? (
          <div className="surface-card rounded-2xl p-7 text-center text-sm text-muted">
            No episodes ingested yet. Click &quot;Ingest episodes&quot; above to
            fetch them from Syosetu.
          </div>
        ) : (
          <div className="space-y-2">
            {episodes.map((ep) => {
              const isReadable = ep.fetchStatus === "fetched";
              const inner = (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted">
                      #{ep.episodeNumber}
                    </span>
                    <span className="text-sm">
                      {ep.titleJa ?? `Episode ${ep.episodeNumber}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {ep.hasTranslation && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">
                        KR
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
                  className="surface-card flex items-center justify-between rounded-xl px-5 py-3 cursor-pointer transition-colors hover:bg-surface-strong"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={ep.id}
                  className="surface-card flex items-center justify-between rounded-xl px-5 py-3"
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
