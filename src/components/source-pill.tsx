import type { SourceSite } from "@/modules/source/domain/source-adapter";

interface SiteMeta {
  short: string;
  full: string;
  mark: string;
  bg: string;
  ink: string;
  markBg: string;
}

const META: Record<SourceSite, SiteMeta> = {
  syosetu: {
    short: "なろう",
    full: "Syosetu",
    mark: "な",
    bg: "var(--src-syosetu-tint)",
    ink: "var(--src-syosetu-ink)",
    markBg: "var(--src-syosetu)",
  },
  nocturne: {
    short: "ノクタ",
    full: "Nocturne",
    mark: "ノ",
    bg: "var(--src-nocturne-tint)",
    ink: "var(--src-nocturne-ink)",
    markBg: "var(--src-nocturne)",
  },
  kakuyomu: {
    short: "カクヨム",
    full: "Kakuyomu",
    mark: "カ",
    bg: "var(--src-kakuyomu-tint)",
    ink: "var(--src-kakuyomu-ink)",
    markBg: "var(--src-kakuyomu)",
  },
  alphapolis: {
    short: "α",
    full: "AlphaPolis",
    mark: "α",
    bg: "var(--src-alphapolis-tint)",
    ink: "var(--src-alphapolis-ink)",
    markBg: "var(--src-alphapolis)",
  },
};

interface Props {
  site: SourceSite;
  variant?: "short" | "full";
  className?: string;
}

export function SourcePill({ site, variant = "short", className }: Props) {
  const m = META[site];
  if (!m) return null;
  return (
    <span
      title={m.full}
      className={`inline-flex items-center gap-1.5 rounded-[4px] py-[3px] pl-1.5 pr-2 text-[10.5px] font-semibold leading-[1.3] tracking-wide ${className ?? ""}`}
      style={{ background: m.bg, color: m.ink }}
    >
      <span
        aria-hidden
        className="grid h-3.5 w-3.5 place-items-center rounded-[3px] font-jp text-[10px] font-bold leading-none text-white"
        style={{ background: m.markBg, letterSpacing: 0 }}
      >
        {m.mark}
      </span>
      <span>{variant === "full" ? m.full : m.short}</span>
    </span>
  );
}
