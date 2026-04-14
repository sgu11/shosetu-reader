"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EpisodeList } from "@/components/episode-list";
import { NovelJobRefresh } from "@/components/novel-job-refresh";

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
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [job, setJob] = useState<JobState | null>(null);
  const [count, setCount] = useState(totalCount);
  const [prevInitialEpisodes, setPrevInitialEpisodes] = useState(initialEpisodes);
  const [prevTotalCount, setPrevTotalCount] = useState(totalCount);
  const hadActiveWork = useRef(hasActiveWork(initialEpisodes, null));

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

  return (
    <section className="space-y-4">
      <NovelJobRefresh job={job} />
      <EpisodeList
        novelId={novelId}
        initialEpisodes={episodes}
        totalCount={count}
      />
    </section>
  );
}
