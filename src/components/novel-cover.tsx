interface Props {
  jp?: string | null;
  kr?: string | null;
  width?: number;
  height?: number;
  ncode?: string | null;
  rank?: number;
  className?: string;
}

function hashTitle(input: string): number {
  let h = 0;
  for (const c of input) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function firstCjkGlyph(s: string | null | undefined): string {
  if (!s) return "";
  const m = s.match(/[぀-ヿ一-鿿]/);
  return m ? m[0] : "";
}

// Typographic identity block. No book-cover gradient, no fake spine —
// hairline rule on the leading edge, single CJK glyph in the corner,
// optional rank numeral. Theme-aware via CSS tokens.
export function NovelCover({
  jp,
  kr,
  width = 92,
  height = 132,
  ncode,
  rank,
  className = "",
}: Props) {
  const seed = jp || kr || "?";
  const hash = hashTitle(seed);
  const glyph = firstCjkGlyph(jp) || firstCjkGlyph(kr) || "無";
  const ncodeShort = ncode ?? `n${(hash % 90000) + 10000}`;
  const rankLabel = rank != null ? String(rank).padStart(2, "0") : "";
  const isMicro = width < 60;

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        width,
        height,
        borderLeft: "1px solid var(--foreground)",
        paddingLeft: isMicro ? 6 : 8,
        paddingRight: isMicro ? 0 : 4,
        paddingTop: 0,
        paddingBottom: 0,
        color: "var(--muted)",
      }}
    >
      <span
        aria-hidden
        className="absolute right-0 top-0 font-jp leading-none"
        style={{
          fontSize: Math.max(11, Math.min(width / 3.2, 22)),
          color: "var(--secondary)",
          letterSpacing: 0,
        }}
      >
        {glyph}
      </span>
      {rankLabel ? (
        <span
          className="absolute bottom-0 left-2 font-mono leading-none num-vert"
          style={{
            fontSize: isMicro ? 11 : 12,
            color: "var(--muted)",
            letterSpacing: "0.04em",
          }}
        >
          {rankLabel}
        </span>
      ) : (
        <span
          className="absolute bottom-1 left-2 font-mono leading-none"
          style={{
            fontSize: isMicro ? 8 : 9,
            color: "var(--muted)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {ncodeShort}
        </span>
      )}
    </div>
  );
}
