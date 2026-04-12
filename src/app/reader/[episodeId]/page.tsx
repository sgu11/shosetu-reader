import { notFound } from "next/navigation";
import Link from "next/link";
import { getReaderPayload } from "@/modules/reader/application/get-reader-payload";

interface Props {
  params: Promise<{ episodeId: string }>;
}

export default async function ReaderPage({ params }: Props) {
  const { episodeId } = await params;
  const payload = await getReaderPayload(episodeId);

  if (!payload) {
    notFound();
  }

  const { novel, episode, navigation } = payload;
  const paragraphs = episode.sourceTextJa?.split("\n") ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Reader header — minimal chrome */}
      <header className="sticky top-0 z-10 border-b hairline bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
          <Link
            href={`/novels/${novel.id}`}
            className="text-sm text-muted hover:text-foreground transition-colors truncate max-w-[60%]"
          >
            &larr; {novel.titleJa}
          </Link>
          <span className="text-xs text-muted">
            #{episode.episodeNumber}
          </span>
        </div>
      </header>

      {/* Reading area */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {/* Episode title */}
        {episode.titleJa && (
          <h1 className="mb-10 text-center text-2xl font-semibold tracking-tight">
            {episode.titleJa}
          </h1>
        )}

        {/* Episode body */}
        {paragraphs.length > 0 ? (
          <div className="reader-text space-y-1 text-base leading-[2] tracking-wide">
            {paragraphs.map((line, i) => (
              <p key={i} className={line.trim() === "" ? "h-6" : ""}>
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border hairline bg-surface p-8 text-center text-sm text-muted">
            Episode content has not been fetched yet.
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <footer className="border-t hairline bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          {navigation.prevEpisodeId ? (
            <Link
              href={`/reader/${navigation.prevEpisodeId}`}
              className="rounded-xl bg-surface-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              &larr; Previous
            </Link>
          ) : (
            <span />
          )}

          <Link
            href={`/novels/${novel.id}`}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Episode list
          </Link>

          {navigation.nextEpisodeId ? (
            <Link
              href={`/reader/${navigation.nextEpisodeId}`}
              className="rounded-xl bg-surface-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              Next &rarr;
            </Link>
          ) : (
            <span />
          )}
        </div>
      </footer>
    </div>
  );
}
