"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

const PAGE_SIZE = 100;

export function EpisodeList({ novelId, initialEpisodes, totalCount }: Props) {
  const { t, locale } = useTranslation();
  void novelId;
  const episodes = initialEpisodes;
  const count = totalCount;

  const totalPages = Math.max(1, Math.ceil(episodes.length / PAGE_SIZE));
  const [pageRaw, setPage] = useState(0);
  // Clamp at render time so list shrinks (e.g. polling drops rows) don't
  // strand the user on an empty page.
  const page = Math.min(pageRaw, totalPages - 1);

  const visible = useMemo(() => {
    if (episodes.length <= PAGE_SIZE) return episodes;
    const start = page * PAGE_SIZE;
    return episodes.slice(start, start + PAGE_SIZE);
  }, [episodes, page]);

  if (episodes.length === 0) {
    return (
      <div className="surface-card rounded-xl p-7 text-center text-sm text-muted">
        {t("novel.noEpisodes")}
      </div>
    );
  }

  const showPagination = episodes.length > PAGE_SIZE;
  const rangeStart = page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, episodes.length);

  return (
    <>
      <h2 className="text-xl font-normal">
        {t("novel.episodesHeading")}{" "}
        <span className="text-base text-muted">({count})</span>
      </h2>
      {showPagination && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          total={episodes.length}
          onChange={setPage}
        />
      )}
      <div className="space-y-1">
        {visible.map((ep) => {
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
      {showPagination && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          total={episodes.length}
          onChange={setPage}
        />
      )}
    </>
  );
}

function PaginationControls({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onChange: (next: number) => void;
}) {
  const btn =
    "rounded-md border border-border bg-surface px-3 py-1 text-sm transition-colors hover:bg-surface-strong disabled:opacity-40 disabled:hover:bg-surface";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
      <span>
        {rangeStart}–{rangeEnd} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => onChange(0)} disabled={page === 0}>
          ⏮
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          ←
        </button>
        <span className="px-2">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
        >
          →
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
        >
          ⏭
        </button>
      </div>
    </div>
  );
}
