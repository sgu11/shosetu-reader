import { notFound } from "next/navigation";
import Link from "next/link";
import { getReaderPayload } from "@/modules/reader/application/get-reader-payload";
import { ProgressTracker } from "@/components/progress-tracker";
import { TranslationToggle } from "@/components/translation-toggle";
import { ReaderSettings } from "@/components/reader-settings";
import { getLocale, t } from "@/lib/i18n";

interface Props {
  params: Promise<{ episodeId: string }>;
}

export default async function ReaderPage({ params }: Props) {
  const locale = await getLocale();
  const { episodeId } = await params;
  const payload = await getReaderPayload(episodeId);

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
  } = payload;
  const paragraphs = episode.sourceTextJa?.split("\n") ?? [];
  const prefaceParagraphs = episode.prefaceJa?.split("\n") ?? [];
  const afterwordParagraphs = episode.afterwordJa?.split("\n") ?? [];
  const hasPreface = prefaceParagraphs.length > 0 && episode.prefaceJa;
  const hasAfterword = afterwordParagraphs.length > 0 && episode.afterwordJa;
  const hasAvailableTranslation = translation?.status === "available";
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

  return (
    <div className="flex min-h-screen flex-col">
      <ProgressTracker
        episodeId={episodeId}
        initialLanguage={initialReaderLanguage}
        initialScrollAnchor={progress?.scrollAnchor ?? null}
        initialProgressPercent={progress?.progressPercent ?? null}
      />

      {/* Back link — scrolls away */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-2">
          <Link
            href={`/novels/${novel.id}`}
            className="text-sm text-muted hover:text-foreground transition-colors truncate"
          >
            &larr; {novel.titleJa}
          </Link>
          <span className="text-xs text-muted">#{episode.episodeNumber}</span>
        </div>
      </div>

      {/* Sticky navigation bar — prev/next + translation controls */}
      <nav className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-6 py-2">
          {navigation.prevEpisodeId ? (
            <Link
              href={`/reader/${navigation.prevEpisodeId}`}
              className="shrink-0 rounded-md bg-surface-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              &larr;
            </Link>
          ) : (
            <span className="invisible shrink-0 rounded-md bg-surface-strong px-4 py-2 text-sm font-medium">&larr;</span>
          )}

          <div className="flex min-w-0 items-center gap-2">
            <TranslationToggle
              episodeId={episodeId}
              initialTranslation={initialTranslation}
              initialLanguage={initialReaderLanguage}
              configuredModel={configuredModel}
              availableTranslations={availableTranslations}
              pendingTranslation={pendingTranslation}
            />
            <ReaderSettings />
          </div>

          {navigation.nextEpisodeId ? (
            <Link
              href={`/reader/${navigation.nextEpisodeId}`}
              className="shrink-0 rounded-md bg-surface-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              &rarr;
            </Link>
          ) : (
            <span className="invisible shrink-0 rounded-md bg-surface-strong px-4 py-2 text-sm font-medium">&rarr;</span>
          )}
        </div>
      </nav>

      {/* Reading area */}
      <main className="reader-area mx-auto w-full flex-1 px-6 py-10">
        {/* Episode title */}
        {episode.titleJa && (
          <div className="mb-10 text-center">
            {locale === "ko" && episode.titleKo ? (
              <>
                <h1 className="text-2xl font-normal tracking-tight">{episode.titleKo}</h1>
                <p className="mt-1 text-sm text-muted/60">{episode.titleJa}</p>
              </>
            ) : (
              <h1 className="text-2xl font-normal tracking-tight">{episode.titleJa}</h1>
            )}
          </div>
        )}

        {/* Episode body */}
        {paragraphs.length > 0 ? (
          <>
            {/* Original Japanese text */}
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
            {/* Korean translation (populated by TranslationToggle) */}
            <div
              data-reader-text
              className="reader-text hidden space-y-1 text-secondary"
            />
          </>
        ) : (
          <div className="surface-card rounded-xl p-8 text-center text-sm text-muted">
            {t(locale, "reader.noContent")}
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <footer className="border-t border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          {navigation.prevEpisodeId ? (
            <Link
              href={`/reader/${navigation.prevEpisodeId}`}
              className="rounded-md bg-surface-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              &larr; {t(locale, "reader.previous")}
            </Link>
          ) : (
            <span className="invisible rounded-md bg-surface-strong px-5 py-2.5 text-sm font-medium">{t(locale, "reader.previous")}</span>
          )}

          <Link
            href={`/novels/${novel.id}`}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            #{episode.episodeNumber}
          </Link>

          {navigation.nextEpisodeId ? (
            <Link
              href={`/reader/${navigation.nextEpisodeId}`}
              className="rounded-md bg-surface-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              {t(locale, "reader.next")} &rarr;
            </Link>
          ) : (
            <span className="invisible rounded-md bg-surface-strong px-5 py-2.5 text-sm font-medium">{t(locale, "reader.next")}</span>
          )}
        </div>
      </footer>
    </div>
  );
}
