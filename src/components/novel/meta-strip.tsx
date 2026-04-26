import { getLocale, t } from "@/lib/i18n";

interface Props {
  totalEpisodes: number | null;
  fetchedEpisodes: number;
  translatedEpisodes: number;
  activeTranslations: number;
  totalCostUsd: number | null;
}

function formatCost(usd: number | null): string {
  if (usd == null) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export async function MetaStrip({
  totalEpisodes,
  fetchedEpisodes,
  translatedEpisodes,
  activeTranslations,
  totalCostUsd,
}: Props) {
  const locale = await getLocale();
  const cells = [
    {
      label: t(locale, "novel.metaEpisodes"),
      value: totalEpisodes != null ? String(totalEpisodes) : t(locale, "novel.metaUnknown"),
      sub: `${fetchedEpisodes} ${t(locale, "status.fetched").toLowerCase()}`,
    },
    {
      label: t(locale, "novel.metaTranslated"),
      value: String(translatedEpisodes),
      sub:
        activeTranslations > 0
          ? t(locale, "novel.metaActiveTranslations", { count: activeTranslations })
          : "—",
    },
    {
      label: t(locale, "novel.metaCost"),
      value: formatCost(totalCostUsd),
      sub: "—",
    },
  ];

  return (
    <div className="grid border-y border-border md:grid-cols-3">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`px-5 py-4 ${i > 0 ? "md:border-l md:border-border" : ""}`}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {c.label}
          </div>
          <div className="mt-0.5 font-serif text-[28px] font-normal text-foreground">
            {c.value}
          </div>
          <div className="text-[10.5px] text-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
