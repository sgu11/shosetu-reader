import Link from "next/link";

interface Props {
  episodeId: string;
  sourceParagraphs: string[];
  primary: {
    modelName: string | null;
    translatedText: string | null;
  };
  compare: {
    modelName: string;
    translatedText: string | null;
  };
}

function shortModel(name: string | null): string {
  if (!name) return "—";
  return name.split("/").pop() ?? name;
}

export function ComparePane({ episodeId, sourceParagraphs, primary, compare }: Props) {
  const primaryLines = primary.translatedText?.split("\n") ?? [];
  const compareLines = compare.translatedText?.split("\n") ?? [];
  const rowCount = Math.max(sourceParagraphs.length, primaryLines.length, compareLines.length);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted">
          Comparing translations — aligned by source paragraph index.
        </div>
        <Link
          href={`/reader/${episodeId}`}
          className="text-xs text-accent hover:underline"
        >
          Exit compare
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="surface-card rounded-xl p-5">
          <h3 className="mb-3 text-xs font-medium uppercase text-muted">
            {shortModel(primary.modelName)}
          </h3>
          <ParagraphList
            sourceCount={rowCount}
            lines={primaryLines}
            source={sourceParagraphs}
          />
        </section>
        <section className="surface-card rounded-xl p-5">
          <h3 className="mb-3 text-xs font-medium uppercase text-muted">
            {shortModel(compare.modelName)}
          </h3>
          <ParagraphList
            sourceCount={rowCount}
            lines={compareLines}
            source={sourceParagraphs}
          />
        </section>
      </div>
    </div>
  );
}

function ParagraphList({
  sourceCount,
  lines,
  source,
}: {
  sourceCount: number;
  lines: string[];
  source: string[];
}) {
  return (
    <div className="space-y-2 text-sm leading-7">
      {Array.from({ length: sourceCount }).map((_, i) => {
        const line = lines[i] ?? "";
        const src = source[i] ?? "";
        const isBlank = line.trim() === "" && src.trim() === "";
        return (
          <p
            key={i}
            data-paragraph-index={i}
            className={isBlank ? "h-4" : "whitespace-pre-wrap"}
            title={src.length > 0 ? src : undefined}
          >
            {line || <span className="text-muted/40">[untranslated]</span>}
          </p>
        );
      })}
    </div>
  );
}
