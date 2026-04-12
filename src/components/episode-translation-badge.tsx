"use client";

import { useEffect, useState } from "react";

interface Props {
  episodeId: string;
  label: string;
  /** When provided by parent, skip internal polling */
  percent?: number | null;
}

export function EpisodeTranslationBadge({ episodeId, label, percent: externalPercent }: Props) {
  const [internalPercent, setInternalPercent] = useState<number | null>(null);
  const hasExternalPercent = externalPercent !== undefined;
  const percent = hasExternalPercent ? externalPercent : internalPercent;

  useEffect(() => {
    if (hasExternalPercent) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/translations/episodes/${episodeId}/status`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const p = data.pendingTranslation?.progressEstimate?.progressPercent;
        if (!cancelled && typeof p === "number") {
          setInternalPercent(Math.round(p));
        }
      } catch {
        // ignore
      }
    }

    void poll();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible" || cancelled) return;
      void poll();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [episodeId, hasExternalPercent]);

  return (
    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent animate-pulse">
      {percent != null ? `${label} ${percent}%` : label}
    </span>
  );
}
