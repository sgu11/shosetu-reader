import { notFound } from "next/navigation";
import { getNovelById, getEpisodesByNovelId } from "@/modules/catalog/application/get-novel";
import { isSubscribed, markEpisodesChecked } from "@/modules/library/application/subscribe";
import Link from "next/link";
import { IngestButton } from "@/components/ingest-button";
import { NovelLiveSection } from "@/components/novel-live-section";
import { SubscribeButton } from "@/components/subscribe-button";
import { NovelGlossaryEditor } from "@/components/novel-glossary-editor";
import { NovelTranslationInventory } from "@/components/novel-translation-inventory";
import { getLocale, t } from "@/lib/i18n";

function shortModelName(modelName: string): string {
  return modelName.split("/").pop() ?? modelName;
}

function formatCost(usd: number | null, locale: "en" | "ko"): string | null {
  if (usd == null) return null;
  if (locale === "ko") {
    const krw = usd * 1500;
    return `${krw.toFixed(1)}원`;
  }
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}


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
    // Clear "new episodes" badge when user visits novel detail
    if (subscribed) {
      markEpisodesChecked(novelId, novel.totalEpisodes).catch(() => {});
    }
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-surface-strong px-3 py-1">
            {t(locale, "status.fetched")} {novel.statusOverview.fetchedEpisodes}
            {novel.totalEpisodes != null ? `/${novel.totalEpisodes}` : ""}
          </span>
          <span className="rounded-full bg-success/10 px-3 py-1 text-success">
            {t(locale, "status.translated")} {novel.statusOverview.translatedEpisodes}
          </span>
          {novel.statusOverview.activeTranslations > 0 && (
            <span className="rounded-full bg-accent/10 px-3 py-1 text-accent animate-pulse">
              {t(locale, "status.activeTranslations", { count: novel.statusOverview.activeTranslations })}
            </span>
          )}
          {formatCost(novel.statusOverview.totalCostUsd, locale) && (
            <span className="rounded-full bg-surface-strong px-3 py-1 text-muted">
              {t(locale, "translation.totalCost")} {formatCost(novel.statusOverview.totalCostUsd, locale)}
            </span>
          )}
          {novel.statusOverview.translatedByModel.map((model) => (
            <span
              key={model.modelName}
              className="rounded-full border border-border px-3 py-1"
              title={model.modelName}
            >
              {shortModelName(model.modelName)} {model.translatedEpisodes}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href={novel.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            {t(locale, "novel.viewOnSyosetu")} &rarr;
          </a>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <SubscribeButton novelId={novelId} initialSubscribed={subscribed} />
          <IngestButton novelId={novelId} />
        </div>
      </section>

      {/* Per-novel glossary & translation guidelines */}
      <NovelGlossaryEditor novelId={novelId} />
      <NovelTranslationInventory
        novelId={novelId}
        translatedEpisodes={novel.statusOverview.translatedEpisodes}
        totalCostUsd={novel.statusOverview.totalCostUsd}
        translatedByModel={novel.statusOverview.translatedByModel}
      />

      {/* Episode list */}
      <NovelLiveSection
        novelId={novelId}
        initialEpisodes={episodes}
        totalCount={totalCount}
      />
    </main>
  );
}
