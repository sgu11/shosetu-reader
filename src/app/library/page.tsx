import Link from "next/link";
import { getLibrary } from "@/modules/library/application/get-library";
import { getLocale, t } from "@/lib/i18n";
import { PageAutoRefresh } from "@/components/page-auto-refresh";

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

export default async function LibraryPage() {
  const locale = await getLocale();
  const { items, totalCount } = await getLibrary();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <PageAutoRefresh intervalMs={15000} />

      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {t(locale, "library.title")}
        </h1>
        <p className="text-sm text-muted">
          {totalCount} {totalCount === 1 ? t(locale, "library.subscribedNovel") : t(locale, "library.subscribedNovels")}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
          <p>{t(locale, "library.empty")}</p>
          <p className="mt-2">
            <Link href="/register" className="text-accent hover:text-accent-hover transition-colors">
              {t(locale, "library.emptyAction")}
            </Link>{" "}
            {t(locale, "library.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.novelId}
              href={`/novels/${item.novelId}`}
              className="surface-card flex flex-col gap-4 rounded-xl px-6 py-4 transition-colors hover:border-border-strong hover:bg-surface-strong sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="truncate text-sm font-medium">
                  {locale === "ko" && item.titleKo ? item.titleKo : item.titleJa}
                </h2>
                {locale === "ko" && item.titleKo && (
                  <p className="truncate text-xs text-muted/60">{item.titleJa}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {item.authorName && <span>{item.authorName}</span>}
                  {item.totalEpisodes != null && (
                    <span>{item.totalEpisodes} {t(locale, "library.eps")}</span>
                  )}
                  {item.isCompleted != null && (
                    <span
                      className={
                        item.isCompleted
                          ? "text-success"
                          : "text-accent"
                      }
                    >
                      {item.isCompleted ? t(locale, "library.completed") : t(locale, "library.ongoing")}
                    </span>
                  )}
                  {item.hasNewEpisodes && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-white">
                      {t(locale, "library.newEpisodes")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
                  <span className="rounded-full bg-surface-strong px-2.5 py-1">
                    {t(locale, "status.fetched")} {item.statusOverview.fetchedEpisodes}
                    {item.totalEpisodes != null ? `/${item.totalEpisodes}` : ""}
                  </span>
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">
                    {t(locale, "status.translated")} {item.statusOverview.translatedEpisodes}
                  </span>
                  {item.statusOverview.activeTranslations > 0 && (
                    <span className="rounded-full bg-accent/10 px-2.5 py-1 text-accent animate-pulse">
                      {t(locale, "status.activeTranslations", { count: item.statusOverview.activeTranslations })}
                    </span>
                  )}
                  {formatCost(item.statusOverview.totalCostUsd, locale) && (
                    <span className="rounded-full bg-surface-strong px-2.5 py-1">
                      {formatCost(item.statusOverview.totalCostUsd, locale)}
                    </span>
                  )}
                  {item.statusOverview.translatedByModel.slice(0, 3).map((model) => (
                    <span
                      key={model.modelName}
                      className="rounded-full border border-border px-2.5 py-1"
                      title={model.modelName}
                    >
                      {shortModelName(model.modelName)} {model.translatedEpisodes}
                    </span>
                  ))}
                  {item.statusOverview.translatedByModel.length > 3 && (
                    <span className="rounded-full border border-border px-2.5 py-1">
                      +{item.statusOverview.translatedByModel.length - 3}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-3 sm:ml-4 sm:w-auto sm:shrink-0 sm:justify-end">
                {item.currentEpisodeNumber != null && (
                  <span className="rounded-full bg-surface-strong px-3 py-1 text-xs text-muted">
                    {t(locale, "library.ep")} {item.currentEpisodeNumber}
                  </span>
                )}
                {item.lastReadAt && (
                  <span className="text-xs text-muted">
                    {new Date(item.lastReadAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
