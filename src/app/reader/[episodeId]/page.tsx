import { notFound } from "next/navigation";
import Link from "next/link";
import { ChapterHeading } from "@/components/reader/chapter-heading";
import { ComparePane } from "@/components/reader/compare-pane";
import { GlossaryDrawer } from "@/components/reader/glossary-drawer";
import { GlossaryToggle } from "@/components/reader/glossary-toggle";
import { PacingBar } from "@/components/reader/pacing-bar";
import { StickyToolbar } from "@/components/reader/sticky-toolbar";
import { ReaderTocSidebar } from "@/components/reader/toc-sidebar";
import { ToolbarOverflow } from "@/components/reader/toolbar-overflow";
import { ProgressTracker } from "@/components/progress-tracker";
import { ReaderSettings } from "@/components/reader-settings";
import { TranslationToggle } from "@/components/translation-toggle";
import { getLocale, t } from "@/lib/i18n";
import { getReaderPayload } from "@/modules/reader/application/get-reader-payload";

interface Props {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ compare?: string }>;
}

export default async function ReaderPage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const { episodeId } = await params;
  const { compare: compareModel } = await searchParams;
  const payload = await getReaderPayload(episodeId, compareModel);

  if (!payload) {
    notFound();
  }

  const {
    novel,
    episode,
    translation,
    translations: availableTranslations,
    pendingTranslation,
    configuredModel,
    navigation,
    progress,
    glossary,
  } = payload;
  const paragraphs = episode.sourceTextJa?.split("\n") ?? [];
  const prefaceParagraphs = episode.prefaceJa?.split("\n") ?? [];
  const afterwordParagraphs = episode.afterwordJa?.split("\n") ?? [];
  const hasPreface = prefaceParagraphs.length > 0 && episode.prefaceJa;
  const hasAfterword = afterwordParagraphs.length > 0 && episode.afterwordJa;
  const hasAvailableTranslation = translation?.status === "available";
  const hasGlossary = glossary.length > 0;
  const initialReaderLanguage =
    progress?.currentLanguage ?? (locale === "ko" && hasAvailableTranslation ? "ko" : "ja");

  const initialTranslation = translation
    ? {
        status: translation.status as "queued" | "processing" | "available" | "failed",
        translatedText: translation.translatedText,
        translatedPreface: translation.translatedPreface ?? null,
        translatedAfterword: translation.translatedAfterword ?? null,
        modelName: translation.modelName,
        errorMessage: translation.errorMessage ?? null,
      }
    : null;

  const isComparing = !!payload.compareTranslation;
  const compareTarget =
    availableTranslations.find((a) => a.modelName !== translation?.modelName)?.modelName ?? null;

  return (
    <div className="frame-paper paper-grain flex min-h-screen flex-col">
      <ProgressTracker
        episodeId={episodeId}
        initialLanguage={initialReaderLanguage}
        initialScrollAnchor={progress?.scrollAnchor ?? null}
        initialProgressPercent={progress?.progressPercent ?? null}
      />
      <PacingBar />

      <div className="border-b border-border lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2.5">
          <Link
            href={`/novels/${novel.id}`}
            className="flex min-w-0 items-center gap-2 truncate text-sm text-secondary transition-colors hover:text-foreground"
          >
            <span aria-hidden>←</span>
            <span className="truncate">{novel.titleKo ?? novel.titleJa}</span>
          </Link>
          <span className="font-mono text-[10px] tracking-wider text-muted">
            #{episode.episodeNumber}
            {episode.titleKo
              ? ` — ${episode.titleKo}`
              : episode.titleJa
                ? ` — ${episode.titleJa}`
                : ""}
          </span>
        </div>
      </div>

      <StickyToolbar>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-1.5 px-3 py-1.5 sm:gap-2 sm:px-6 sm:py-2">
          {navigation.prevEpisodeId ? (
            <Link
              href={`/reader/${navigation.prevEpisodeId}`}
              className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-sm font-medium text-secondary transition-colors hover:bg-surface-strong hover:text-foreground sm:px-3 sm:py-1.5"
            >
              ←
            </Link>
          ) : (
            <span className="invisible shrink-0 rounded-full px-2.5 py-1 text-sm font-medium sm:px-3 sm:py-1.5">←</span>
          )}

          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <TranslationToggle
              episodeId={episodeId}
              initialTranslation={initialTranslation}
              initialLanguage={initialReaderLanguage}
              configuredModel={configuredModel}
              availableTranslations={availableTranslations}
              pendingTranslation={pendingTranslation}
            />
            <ToolbarOverflow>
              <ReaderSettings />
              {hasGlossary ? <GlossaryToggle /> : null}
              {(isComparing || compareTarget) && (
                <Link
                  href={
                    isComparing
                      ? `/reader/${episodeId}`
                      : `/reader/${episodeId}?compare=${encodeURIComponent(compareTarget!)}`
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    isComparing
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:text-foreground"
                  }`}
                  aria-label="Toggle translation comparison"
                  title={isComparing ? "Exit compare" : "Compare translations"}
                >
                  ⇄
                </Link>
              )}
            </ToolbarOverflow>
          </div>

          {navigation.nextEpisodeId ? (
            <Link
              href={`/reader/${navigation.nextEpisodeId}`}
              className="shrink-0 rounded-full border border-border bg-surface px-2.5 py-1 text-sm font-medium text-secondary transition-colors hover:bg-surface-strong hover:text-foreground sm:px-3 sm:py-1.5"
            >
              →
            </Link>
          ) : (
            <span className="invisible shrink-0 rounded-full px-2.5 py-1 text-sm font-medium sm:px-3 sm:py-1.5">→</span>
          )}
        </div>
      </StickyToolbar>

      <div
        data-reader-grid
        className={`mx-auto grid w-full max-w-6xl flex-1 gap-8 px-6 py-10 lg:px-12 ${
          hasGlossary
            ? "lg:grid-cols-[220px_minmax(0,1fr)_300px]"
            : "lg:grid-cols-[220px_minmax(0,1fr)]"
        }`}
      >
        <ReaderTocSidebar
          entries={navigation.toc}
          currentEpisodeId={episode.id}
          totalEpisodes={navigation.totalEpisodes}
          novelTitleJa={novel.titleJa}
          novelTitleKo={novel.titleKo}
          novelId={novel.id}
          currentEpisodeNumber={episode.episodeNumber}
        />
        <main className="reader-area mx-auto w-full">
          {payload.compareTranslation && translation && (
            <div className="mb-8">
              <ComparePane
                episodeId={episodeId}
                sourceParagraphs={paragraphs}
                primary={{
                  modelName: translation.modelName,
                  translatedText: translation.translatedText,
                }}
                compare={payload.compareTranslation}
              />
            </div>
          )}

          <ChapterHeading
            episodeNumber={episode.episodeNumber}
            titleJa={episode.titleJa}
            titleKo={episode.titleKo}
            locale={locale}
          />

          {paragraphs.length > 0 ? (
            <>
              <div
                data-original-text
                className="reader-text space-y-1 tracking-wide text-secondary"
              >
                {hasPreface && (
                  <>
                    <div data-section="preface" className="text-muted/80">
                      {prefaceParagraphs.map((line, i) => (
                        <p
                          key={`pf-${i}`}
                          className={line.trim() === "" ? "h-6" : ""}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                    <hr className="my-8 border-border/50" />
                  </>
                )}
                {paragraphs.map((line, i) => (
                  <p
                    key={i}
                    data-reader-paragraph={`p-${i}`}
                    className={line.trim() === "" ? "h-6" : ""}
                  >
                    {line}
                  </p>
                ))}
                {hasAfterword && (
                  <>
                    <hr className="my-8 border-border/50" />
                    <div data-section="afterword" className="text-muted/80">
                      {afterwordParagraphs.map((line, i) => (
                        <p
                          key={`aw-${i}`}
                          className={line.trim() === "" ? "h-6" : ""}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div
                data-reader-text
                className="reader-text hidden space-y-1 text-secondary"
              />
              <div
                data-bilingual-text
                className="reader-text hidden text-secondary"
              />
            </>
          ) : (
            <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
              {t(locale, "reader.noContent")}
            </div>
          )}

          <footer className="mt-10 flex items-center justify-between border-t border-border pt-5">
            {navigation.prevEpisodeId ? (
              <Link
                href={`/reader/${navigation.prevEpisodeId}`}
                className="font-serif text-sm italic text-secondary transition-colors hover:text-foreground"
              >
                ← {t(locale, "reader.previous")}
              </Link>
            ) : (
              <span className="invisible font-serif text-sm">{t(locale, "reader.previous")}</span>
            )}
            <Link
              href={`/novels/${novel.id}`}
              className="font-mono text-xs text-muted transition-colors hover:text-foreground"
            >
              #{episode.episodeNumber}
            </Link>
            {navigation.nextEpisodeId ? (
              <Link
                href={`/reader/${navigation.nextEpisodeId}`}
                className="font-serif text-sm italic text-secondary transition-colors hover:text-foreground"
              >
                {t(locale, "reader.next")} →
              </Link>
            ) : (
              <span className="font-serif text-sm italic text-muted">
                {t(locale, "reader.endOfNovel")}
              </span>
            )}
          </footer>
        </main>

        {hasGlossary ? <GlossaryDrawer entries={glossary} /> : null}
      </div>
    </div>
  );
}
