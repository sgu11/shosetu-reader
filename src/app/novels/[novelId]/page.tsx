import { notFound } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { IngestButton } from "@/components/ingest-button";
import { MetaStrip } from "@/components/novel/meta-strip";
import { NovelHero } from "@/components/novel/novel-hero";
import { NovelGlossaryEditor } from "@/components/novel-glossary-editor";
import { NovelLiveSection } from "@/components/novel-live-section";
import { NovelTranslationInventory } from "@/components/novel-translation-inventory";
import { NovelQualitySummary } from "@/components/quality/novel-quality-summary";
import { getLocale, t } from "@/lib/i18n";
import { getEpisodesByNovelId, getNovelById } from "@/modules/catalog/application/get-novel";
import { isSubscribed, markEpisodesChecked } from "@/modules/library/application/subscribe";

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
    if (subscribed) {
      markEpisodesChecked(novelId, novel.totalEpisodes).catch(() => {});
    }
  } catch {
    // DB not ready — default to unsubscribed
  }

  return (
    <main className="frame-paper paper-grain flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-14 py-10">
        <Link
          href="/library"
          className="font-serif text-sm italic text-secondary transition-colors hover:text-foreground"
        >
          ← {t(locale, "novel.backToLibrary")}
        </Link>

        <NovelHero novelId={novelId} novel={novel} subscribed={subscribed} />

        <MetaStrip
          totalEpisodes={novel.totalEpisodes}
          fetchedEpisodes={novel.statusOverview.fetchedEpisodes}
          translatedEpisodes={novel.statusOverview.translatedEpisodes}
          activeTranslations={novel.statusOverview.activeTranslations}
          totalCostUsd={novel.statusOverview.totalCostUsd}
        />

        <div>
          <Eyebrow>{t(locale, "ingest.actions")}</Eyebrow>
          <div className="mt-3">
            <IngestButton novelId={novelId} />
          </div>
        </div>

        <NovelQualitySummary novelId={novelId} />

        <NovelGlossaryEditor novelId={novelId} />

        <NovelTranslationInventory
          novelId={novelId}
          translatedEpisodes={novel.statusOverview.translatedEpisodes}
          totalCostUsd={novel.statusOverview.totalCostUsd}
          translatedByModel={novel.statusOverview.translatedByModel}
        />

        <section>
          <Eyebrow>{t(locale, "novel.episodesHeading")}</Eyebrow>
          <div className="mt-3">
            <NovelLiveSection
              novelId={novelId}
              initialEpisodes={episodes}
              totalCount={totalCount}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
