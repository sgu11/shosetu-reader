"use client";

import { useCallback, useEffect, useState } from "react";
import { Eyebrow } from "@/components/eyebrow";
import { RankingHero } from "@/components/ranking/ranking-hero";
import { RankingRow } from "@/components/ranking/ranking-row";
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
      // best-effort
    } finally {
      setTranslating(false);
    }
  }, []);

  const fetchRanking = useCallback(
    async (p: Period) => {
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
    },
    [translateTitles],
  );

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
            item.ncode === ncode ? { ...item, novelId: data.novel.id } : item,
          ),
        );
      }
    } catch {
      // silent
    } finally {
      setRegistering(null);
    }
  }

  const heroItem = items[0];
  const restItems = items.slice(1);

  return (
    <main className="frame-paper paper-grain flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-14 py-10">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Eyebrow>{t("ranking.eyebrow")}</Eyebrow>
            <h1 className="mt-2 mb-1 font-serif text-5xl font-normal tracking-tight text-foreground md:text-6xl">
              <span className="italic">{t("ranking.headlineFlair")}</span>{" "}
              {t("ranking.headlineMain")}
            </h1>
            <p className="m-0 font-serif text-sm text-secondary">
              {t("ranking.tagline")}
            </p>
          </div>

          <div className="surface-card flex gap-1 rounded-full p-1">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-deep text-accent-contrast"
                    : "text-secondary hover:bg-surface-strong"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
            {t("ranking.loading")}
          </div>
        ) : items.length === 0 ? (
          <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
            {t("ranking.empty")}
          </div>
        ) : (
          <>
            {heroItem ? (
              <RankingHero
                item={heroItem}
                titleKo={titleKo[heroItem.ncode]}
                onRegister={handleRegister}
                registering={registering === heroItem.ncode}
              />
            ) : null}

            <div>
              {restItems.map((item) => (
                <RankingRow
                  key={item.ncode}
                  item={item}
                  titleKo={titleKo[item.ncode]}
                  onRegister={handleRegister}
                  registering={registering === item.ncode}
                />
              ))}
            </div>

            {translating ? (
              <p className="py-2 text-center text-xs text-muted">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle" />
                {t("ranking.translatingTitles")}
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
