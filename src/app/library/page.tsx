import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { LibraryFilters, type LibraryFilter } from "@/components/library/library-filters";
import { ShelfCard } from "@/components/library/shelf-card";
import { PageAutoRefresh } from "@/components/page-auto-refresh";
import { getLocale, t } from "@/lib/i18n";
import { getLibrary } from "@/modules/library/application/get-library";
import type { LibraryItem } from "@/modules/library/api/schemas";

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function isReading(item: LibraryItem): boolean {
  return item.currentEpisodeNumber != null && item.isCompleted !== true;
}

function isPending(item: LibraryItem): boolean {
  return item.statusOverview.activeTranslations > 0;
}

function applyFilter(items: LibraryItem[], filter: LibraryFilter): LibraryItem[] {
  switch (filter) {
    case "reading":
      return items.filter(isReading);
    case "new":
      return items.filter((i) => i.hasNewEpisodes);
    case "completed":
      return items.filter((i) => i.isCompleted === true);
    case "pending":
      return items.filter(isPending);
    default:
      return items;
  }
}

function tallyCounts(items: LibraryItem[]): Record<LibraryFilter, number> {
  return {
    all: items.length,
    reading: items.filter(isReading).length,
    new: items.filter((i) => i.hasNewEpisodes).length,
    completed: items.filter((i) => i.isCompleted === true).length,
    pending: items.filter(isPending).length,
  };
}

const VALID_FILTERS: ReadonlyArray<LibraryFilter> = [
  "all",
  "reading",
  "new",
  "completed",
  "pending",
];

export default async function LibraryPage({ searchParams }: Props) {
  const locale = await getLocale();
  const { filter: filterParam } = await searchParams;
  const filter: LibraryFilter = VALID_FILTERS.includes(filterParam as LibraryFilter)
    ? (filterParam as LibraryFilter)
    : "all";

  const { items } = await getLibrary();
  const counts = tallyCounts(items);
  const visible = applyFilter(items, filter);

  return (
    <main className="frame-paper paper-grain flex flex-1 flex-col">
      <PageAutoRefresh intervalMs={15000} />
      <div className="mx-auto w-full max-w-6xl px-14 py-10">
        <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Eyebrow>{t(locale, "library.eyebrow")}</Eyebrow>
            <h1 className="mt-2 mb-1 font-serif text-5xl font-normal tracking-tight text-foreground md:text-6xl">
              {t(locale, "library.heading")}{" "}
              <span className="italic text-accent">
                {t(locale, "library.headingFlair")}
              </span>
            </h1>
            <p className="m-0 font-serif text-sm text-secondary">
              {t(locale, "library.subscribedSummary", {
                count: counts.all,
                newCount: counts.new,
              })}
            </p>
          </div>
          <LibraryFilters counts={counts} />
        </header>

        {visible.length === 0 ? (
          <div className="surface-card mt-10 rounded-xl p-8 text-center text-sm text-muted">
            <p>{t(locale, "library.empty")}</p>
            <p className="mt-2">
              <Link
                href="/register"
                className="text-accent transition-colors hover:text-accent-hover"
              >
                {t(locale, "library.emptyAction")}
              </Link>{" "}
              {t(locale, "library.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item) => (
              <ShelfCard key={item.novelId} item={item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
