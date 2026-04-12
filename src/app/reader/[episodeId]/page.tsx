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

  const { novel, episode, translation, navigation } = payload;
  const paragraphs = episode.sourceTextJa?.split("\n") ?? [];

  const initialTranslation = translation
    ? {
        status: translation.status as "queued" | "processing" | "available" | "failed",
        translatedText: translation.translatedText,
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <ProgressTracker episodeId={episodeId} language="ja" />

      {/* Reader header — minimal chrome */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <Link
            href={`/novels/${novel.id}`}
            className="text-sm text-muted hover:text-foreground transition-colors truncate max-w-[40%]"
          >
            &larr; {novel.titleJa}
          </Link>
          <div className="flex items-center gap-2">
            <TranslationToggle
              episodeId={episodeId}
              initialTranslation={initialTranslation}
            />
            <ReaderSettings />
          </div>
          <span className="code-label">
            #{episode.episodeNumber}
          </span>
        </div>
      </header>

      {/* Reading area */}
      <main className="reader-area mx-auto w-full flex-1 px-6 py-10">
        {/* Episode title */}
        {episode.titleJa && (
          <h1 className="mb-10 text-center text-2xl font-normal tracking-tight">
            {episode.titleJa}
          </h1>
        )}

        {/* Episode body */}
        {paragraphs.length > 0 ? (
          <>
            {/* Original Japanese text */}
            <div
              data-original-text
              className="reader-text space-y-1 tracking-wide text-secondary"
            >
              {paragraphs.map((line, i) => (
                <p key={i} className={line.trim() === "" ? "h-6" : ""}>
                  {line}
                </p>
              ))}
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
            <span />
          )}

          <Link
            href={`/novels/${novel.id}`}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {t(locale, "reader.episodeList")}
          </Link>

          {navigation.nextEpisodeId ? (
            <Link
              href={`/reader/${navigation.nextEpisodeId}`}
              className="rounded-md bg-surface-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              {t(locale, "reader.next")} &rarr;
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </div>
  );
}
