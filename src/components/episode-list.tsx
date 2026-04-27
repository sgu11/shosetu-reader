"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/client";
import { EpisodeTranslationBadge } from "./episode-translation-badge";

interface Episode {
  id: string;
  episodeNumber: number;
  titleJa: string | null;
  titleKo: string | null;
  fetchStatus: "pending" | "fetching" | "fetched" | "failed";
  hasTranslation: boolean;
  translationStatus: "queued" | "processing" | "available" | "failed" | null;
  translationModel: string | null;
  translationProgressPercent?: number | null;
  publishedAt: string | null;
}

interface Props {
  novelId: string;
  initialEpisodes: Episode[];
  totalCount: number;
}

export function EpisodeList({ novelId, initialEpisodes, totalCount }: Props) {
  const { t, locale } = useTranslation();
  void novelId;
  const episodes = initialEpisodes;
  const count = totalCount;

  if (episodes.length === 0) {
    return (
      <div className="surface-card rounded-xl p-7 text-center text-sm text-muted">
        {t("novel.noEpisodes")}
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-normal">
        {t("novel.episodesHeading")}{" "}
        <span className="text-base text-muted">({count})</span>
      </h2>
      <div className="space-y-1">
        {episodes.map((ep) => {
          const isReadable = ep.fetchStatus === "fetched";
          const isProcessing = ep.translationStatus === "processing";

          const inner = (
            <>
              <div className="flex min-w-0 items-start gap-3">
                <span className="text-sm text-muted">#{ep.episodeNumber}</span>
                <div className="min-w-0 flex-1">
                  {locale === "ko" && ep.titleKo ? (
                    <>
                      <span className="block truncate text-sm">{ep.titleKo}</span>
                      <span className="block truncate text-xs text-muted/60">{ep.titleJa}</span>
                    </>
                  ) : (
                    <span className="text-sm">
                      {ep.titleJa ?? `Episode ${ep.episodeNumber}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {ep.translationStatus === "available" ? (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success" title={ep.translationModel ?? undefined}>
                    KO
                  </span>
                ) : isProcessing ? (
                  <EpisodeTranslationBadge
                    episodeId={ep.id}
                    label={t("status.translationProcessing")}
                    percent={ep.translationProgressPercent ?? null}
                  />
                ) : ep.translationStatus === "queued" ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent animate-pulse">
                    {t("status.translationQueued")}
                  </span>
                ) : ep.translationStatus === "failed" ? (
                  <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs text-error">
                    {t("status.translationFailed")}
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
                  {ep.fetchStatus === "pending"
                    ? t("status.fetchPending")
                    : ep.fetchStatus === "fetching"
                      ? t("status.fetchFetching")
                      : ep.fetchStatus === "fetched"
                        ? t("status.fetched")
                        : t("status.fetchFailed")}
                </span>
              </div>
            </>
          );

          const cardClass =
            "block relative overflow-hidden rounded-lg border border-border bg-surface px-5 py-3 transition-colors" +
            (isReadable ? " hover:border-border-strong hover:bg-surface-strong" : "");
          const contentClass =
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

          const progressBar = isProcessing ? (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/20">
              <div className="h-full animate-pulse rounded-full bg-accent" style={{ width: "60%" }} />
            </div>
          ) : null;

          return isReadable ? (
            <Link key={ep.id} href={`/reader/${ep.id}`} className={cardClass}>
              <div className={contentClass}>{inner}</div>
              {progressBar}
            </Link>
          ) : (
            <div key={ep.id} className={cardClass}>
              <div className={contentClass}>{inner}</div>
              {progressBar}
            </div>
          );
        })}
      </div>
    </>
  );
}
