import Link from "next/link";
import { getLibrary } from "@/modules/library/application/get-library";
import { getLocale, t } from "@/lib/i18n";

export default async function LibraryPage() {
  const locale = await getLocale();
  const { items, totalCount } = await getLibrary();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
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
              className="surface-card flex items-center justify-between rounded-xl px-6 py-4 transition-colors hover:border-border-strong hover:bg-surface-strong"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="truncate text-sm font-medium">
                  {locale === "ko" && item.titleKo ? item.titleKo : item.titleJa}
                </h2>
                {locale === "ko" && item.titleKo && (
                  <p className="truncate text-xs text-muted/60">{item.titleJa}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted">
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
                </div>
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-3">
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
