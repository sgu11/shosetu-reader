import { Fragment } from "react";
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

export function splitNonBlank(text: string | null): string[] {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

export type CompareRow =
  | { kind: "blank"; src: string }
  | { kind: "content"; src: string; primary: string; compare: string };

// Align translations against non-blank source paragraphs as the canonical
// spine. Blank source paragraphs become visual gaps that do NOT consume a
// translation line, so an extra `\n` from one model cannot shift downstream
// rows out of alignment. Any leftover lines past the source are appended at
// the end so nothing is silently dropped.
export function buildRows(
  sourceParagraphs: string[],
  primary: string[],
  compare: string[],
): { rows: CompareRow[]; mismatch: boolean } {
  const rows: CompareRow[] = [];
  let pi = 0;
  let ci = 0;
  for (const src of sourceParagraphs) {
    if (src.trim() === "") {
      rows.push({ kind: "blank", src });
      continue;
    }
    rows.push({
      kind: "content",
      src,
      primary: primary[pi] ?? "",
      compare: compare[ci] ?? "",
    });
    pi += 1;
    ci += 1;
  }
  while (pi < primary.length || ci < compare.length) {
    rows.push({
      kind: "content",
      src: "",
      primary: primary[pi] ?? "",
      compare: compare[ci] ?? "",
    });
    pi += 1;
    ci += 1;
  }
  const srcNonBlank = sourceParagraphs.filter((s) => s.trim() !== "").length;
  const mismatch = primary.length !== srcNonBlank || compare.length !== srcNonBlank;
  return { rows, mismatch };
}

export function ComparePane({ episodeId, sourceParagraphs, primary, compare }: Props) {
  const primaryLines = splitNonBlank(primary.translatedText);
  const compareLines = splitNonBlank(compare.translatedText);
  const { rows, mismatch } = buildRows(sourceParagraphs, primaryLines, compareLines);
  const srcNonBlank = sourceParagraphs.filter((s) => s.trim() !== "").length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted">
          Comparing translations — aligned by non-blank source paragraph.
          {mismatch && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              (paragraph count mismatch: src {srcNonBlank} / {shortModel(primary.modelName)} {primaryLines.length} / {shortModel(compare.modelName)} {compareLines.length})
            </span>
          )}
        </div>
        <Link
          href={`/reader/${episodeId}`}
          className="text-xs text-accent hover:underline"
        >
          Exit compare
        </Link>
      </header>

      <div className="surface-card rounded-xl p-5">
        <div className="grid grid-cols-2 gap-x-4 text-sm leading-7">
          <h3 className="mb-3 text-xs font-medium uppercase text-muted">
            {shortModel(primary.modelName)}
          </h3>
          <h3 className="mb-3 text-xs font-medium uppercase text-muted">
            {shortModel(compare.modelName)}
          </h3>
          {rows.map((row, i) => {
            if (row.kind === "blank") {
              return (
                <Fragment key={i}>
                  <p className="h-4" />
                  <p className="h-4" />
                </Fragment>
              );
            }
            const titleAttr = row.src.length > 0 ? row.src : undefined;
            return (
              <Fragment key={i}>
                <p data-paragraph-index={i} className="whitespace-pre-wrap pb-2" title={titleAttr}>
                  {row.primary}
                </p>
                <p data-paragraph-index={i} className="whitespace-pre-wrap pb-2" title={titleAttr}>
                  {row.compare}
                </p>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
