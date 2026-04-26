interface Props {
  episodeNumber: number;
  titleJa: string | null;
  titleKo: string | null;
  locale: "en" | "ko";
}

const NUMBER_WORDS: Record<number, string> = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
};

function spellNumber(n: number): string {
  if (n < 10) return NUMBER_WORDS[n] ?? String(n);
  return String(n);
}

export function ChapterHeading({ episodeNumber, titleJa, titleKo, locale }: Props) {
  const eyebrow = `CHAPTER ${spellNumber(episodeNumber).toUpperCase()}`;
  const primary = locale === "ko" && titleKo ? titleKo : titleJa;
  const secondary = locale === "ko" && titleKo && titleJa ? titleJa : null;

  return (
    <header className="mb-8 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        {eyebrow}
      </div>
      {primary ? (
        <h1 className="mt-2 mb-1 font-serif text-3xl font-normal italic text-foreground md:text-4xl">
          {primary}
        </h1>
      ) : null}
      {secondary ? (
        <div className="font-serif text-base text-secondary">{secondary}</div>
      ) : null}
      <div className="mx-auto mt-3 h-px w-7 bg-border-strong" />
    </header>
  );
}
