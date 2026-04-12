"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

type Period = "daily" | "weekly" | "monthly" | "quarterly";

interface RankingItem {
  rank: number;
  ncode: string;
  title: string;
  authorName: string;
  totalEpisodes: number;
  isCompleted: boolean;
  sourceUrl: string;
  novelId: string | null;
}

export default function RankingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("daily");
  const [items, setItems] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const [titleKo, setTitleKo] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);

  const periods: { value: Period; label: string }[] = [
    { value: "daily", label: t("ranking.daily") },
    { value: "weekly", label: t("ranking.weekly") },
    { value: "monthly", label: t("ranking.monthly") },
    { value: "quarterly", label: t("ranking.quarterly") },
  ];

  const translateTitles = useCallback(async (rankItems: RankingItem[]) => {
    if (rankItems.length === 0) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/ranking/translate-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: rankItems.map((i) => i.title) }),
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        rankItems.forEach((item, idx) => {
          if (data.translations[idx] && data.translations[idx] !== item.title) {
            map[item.ncode] = data.translations[idx];
          }
        });
        setTitleKo(map);
      }
    } catch {
      // translation is best-effort
    } finally {
      setTranslating(false);
    }
  }, []);

  const fetchRanking = useCallback(async (p: Period) => {
    setLoading(true);
    setTitleKo({});
    try {
      const res = await fetch(`/api/ranking?period=${p}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        translateTitles(data.items);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [translateTitles]);

  useEffect(() => {
    fetchRanking(period);
  }, [period, fetchRanking]);

  async function handleRegister(ncode: string) {
    setRegistering(ncode);
    try {
      const res = await fetch("/api/novels/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: ncode }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((item) =>
            item.ncode === ncode
              ? { ...item, novelId: data.novel.id }
              : item,
          ),
        );
      }
    } catch {
      // silent
    } finally {
      setRegistering(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {t("ranking.title")}
        </h1>
        <p className="text-sm text-muted">
          {t("ranking.subtitle")}
        </p>
      </div>

      {/* Period tabs */}
      <div className="flex rounded-full border border-border p-0.5 self-start">
        {periods.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              period === p.value
                ? "bg-surface-strong text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Ranking list */}
      {loading ? (
        <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
          {t("ranking.loading")}
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
          {t("ranking.empty")}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.ncode}
              className="surface-card flex items-center gap-4 rounded-xl px-5 py-4"
            >
              {/* Rank */}
              <span className="w-8 shrink-0 text-center text-sm font-medium text-muted">
                {item.rank}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  {titleKo[item.ncode] && (
                    <p className="truncate text-sm font-medium group-hover:text-accent transition-colors">
                      {titleKo[item.ncode]}
                    </p>
                  )}
                  <p className={`truncate text-sm transition-colors ${
                    titleKo[item.ncode]
                      ? "text-muted group-hover:text-muted/80"
                      : "font-medium group-hover:text-accent"
                  }`}>
                    {item.title}
                  </p>
                </a>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{item.authorName}</span>
                  <span>{item.totalEpisodes} {t("ranking.eps")}</span>
                </div>
              </div>

              {/* Action */}
              {item.novelId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/novels/${item.novelId}`)}
                  className="btn-pill btn-secondary shrink-0 text-xs"
                >
                  {t("ranking.view")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRegister(item.ncode)}
                  disabled={registering === item.ncode}
                  className="btn-pill btn-accent shrink-0 text-xs"
                >
                  {registering === item.ncode ? "..." : t("ranking.register")}
                </button>
              )}
            </div>
          ))}

          {/* Translating indicator */}
          {translating && (
            <p className="text-center text-xs text-muted py-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent mr-1.5 align-middle" />
              {t("ranking.translatingTitles")}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
