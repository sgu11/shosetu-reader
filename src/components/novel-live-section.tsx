"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EpisodeList } from "@/components/episode-list";
import { NovelJobRefresh } from "@/components/novel-job-refresh";
import { useTranslation } from "@/lib/i18n/client";

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

interface JobState {
  id: string;
  jobType: string;
  status: string;
  result: {
    processed?: number | null;
    total?: number | null;
    fetched?: number | null;
    failed?: number | null;
    queued?: number | null;
  } | null;
}

interface Props {
  novelId: string;
  initialEpisodes: Episode[];
  totalCount: number;
}

function hasActiveWork(episodes: Episode[], job: JobState | null) {
  if (job && (job.status === "queued" || job.status === "running")) {
    return true;
  }

  return episodes.some((episode) =>
    episode.fetchStatus === "pending" ||
    episode.fetchStatus === "fetching" ||
    episode.translationStatus === "queued" ||
    episode.translationStatus === "processing",
  );
}

export function NovelLiveSection({ novelId, initialEpisodes, totalCount }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [job, setJob] = useState<JobState | null>(null);
  const [count, setCount] = useState(totalCount);
  const [prevInitialEpisodes, setPrevInitialEpisodes] = useState(initialEpisodes);
  const [prevTotalCount, setPrevTotalCount] = useState(totalCount);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const hadActiveWork = useRef(hasActiveWork(initialEpisodes, null));

  async function handleStop() {
    if (cancelling) return;
    if (!window.confirm(t("status.confirmStop"))) return;
    setCancelling(true);
    setCancelMessage(null);
    try {
      const res = await fetch(`/api/novels/${novelId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setCancelMessage(
          t("status.stoppedSummary", {
            jobs: data.cancelledJobs ?? 0,
            translations: data.cancelledTranslations ?? 0,
          }),
        );
        router.refresh();
      } else {
        setCancelMessage(t("status.stopFailed"));
      }
    } catch {
      setCancelMessage(t("status.stopFailed"));
    } finally {
      setCancelling(false);
    }
  }

  if (prevInitialEpisodes !== initialEpisodes) {
    setPrevInitialEpisodes(initialEpisodes);
    setEpisodes(initialEpisodes);
  }

  if (prevTotalCount !== totalCount) {
    setPrevTotalCount(totalCount);
    setCount(totalCount);
  }

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/novels/${novelId}/live-status`);
        if (!response.ok || cancelled) {
          return;
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        const rawEpisodes = Array.isArray(data.episodes) ? data.episodes : initialEpisodes;
        const titleByEpisodeId = new Map(
          episodes.map((episode) => [episode.id, episode.titleKo ?? null]),
        );
        const nextEpisodes = rawEpisodes.map((episode: Episode) => ({
          ...episode,
          titleKo: episode.titleKo ?? titleByEpisodeId.get(episode.id) ?? null,
        }));
        const nextJob = data.job ?? null;

        setEpisodes(nextEpisodes);
        setCount(typeof data.totalCount === "number" ? data.totalCount : nextEpisodes.length);
        setJob(nextJob);

        const currentlyActive = hasActiveWork(nextEpisodes, nextJob);
        if (hadActiveWork.current && !currentlyActive) {
          router.refresh();
        }
        hadActiveWork.current = currentlyActive;
      } catch {
        // Ignore transient polling failures.
      }
    }

    void poll();

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || cancelled) {
        return;
      }

      void poll();
    }, hasActiveWork(episodes, job) ? 5000 : 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [novelId, episodes, initialEpisodes, job, router]);

  const showInlineStop = !job && hasActiveWork(episodes, job);

  return (
    <section className="space-y-4">
      <NovelJobRefresh novelId={novelId} job={job} />
      {showInlineStop ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
            {t("status.activeBackground")}
          </span>
          <button
            type="button"
            onClick={handleStop}
            disabled={cancelling}
            className="rounded-full border border-error/40 px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-error transition-colors hover:bg-error/10 disabled:opacity-40"
          >
            {cancelling ? "…" : `■ ${t("status.stop")}`}
          </button>
        </div>
      ) : null}
      {cancelMessage ? (
        <p className="font-mono text-[10.5px] uppercase tracking-wider text-muted">
          {cancelMessage}
        </p>
      ) : null}
      <EpisodeList
        novelId={novelId}
        initialEpisodes={episodes}
        totalCount={count}
      />
    </section>
  );
}
