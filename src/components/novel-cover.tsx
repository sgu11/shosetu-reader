interface Props {
  jp?: string | null;
  kr?: string | null;
  width?: number;
  height?: number;
  variant?: "paper" | "night";
  ncode?: string | null;
  className?: string;
}

function hashTitle(input: string): number {
  let h = 0;
  for (const c of input) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function NovelCover({
  jp,
  kr,
  width = 92,
  height = 132,
  variant = "paper",
  ncode,
  className = "",
}: Props) {
  const seed = jp || kr || "?";
  const hash = hashTitle(seed);
  const hue = hash % 360;

  const palette =
    variant === "paper"
      ? {
          bg: `oklch(0.93 0.04 ${hue})`,
          ink: `oklch(0.28 0.04 ${(hue + 30) % 360})`,
          rule: `oklch(0.55 0.06 ${hue})`,
          sub: `oklch(0.45 0.04 ${hue})`,
          shadow:
            "0 1px 0 rgba(0,0,0,.06), 0 8px 18px -10px rgba(0,0,0,.25)",
        }
      : {
          bg: `oklch(0.18 0.03 ${hue})`,
          ink: `oklch(0.92 0.04 ${(hue + 30) % 360})`,
          rule: `oklch(0.65 0.08 ${hue})`,
          sub: `oklch(0.7 0.04 ${hue})`,
          shadow:
            "0 1px 0 rgba(255,255,255,.04), 0 8px 18px -10px rgba(0,0,0,.6)",
        };

  const heroJp = (jp || "").replace(/[【】[\]『』「」]/g, "").slice(0, 8);
  const ncodeShort = ncode ?? `n${(hash % 90000) + 10000}`;
  const fontPx = Math.max(11, Math.min(width / 7, 16));

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[3px] ${className}`}
      style={{
        width,
        height,
        background: palette.bg,
        color: palette.ink,
        boxShadow: palette.shadow,
        fontFamily: "var(--font-jp)",
      }}
    >
      <div
        className="absolute inset-y-1.5 left-1.5 w-px opacity-40"
        style={{ background: palette.rule }}
      />
      <div
        className="absolute inset-y-1.5 right-1.5 w-px opacity-40"
        style={{ background: palette.rule }}
      />
      <div
        className="absolute inset-3.5 font-semibold leading-tight"
        style={{
          writingMode: "vertical-rl",
          fontSize: fontPx,
          letterSpacing: "0.02em",
        }}
      >
        {heroJp || "無題"}
      </div>
      <div
        className="absolute bottom-2 left-2 font-mono text-[8px] tracking-wider"
        style={{ color: palette.sub }}
      >
        {ncodeShort}
      </div>
    </div>
  );
}
