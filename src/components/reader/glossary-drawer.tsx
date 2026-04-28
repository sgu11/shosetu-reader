import { Eyebrow } from "@/components/eyebrow";
import { getLocale, t } from "@/lib/i18n";

interface GlossaryEntry {
  termJa: string;
  termKo: string;
  category: "character" | "place" | "term" | "skill" | "honorific";
  notes: string | null;
  importance: number;
}

interface Props {
  entries: GlossaryEntry[];
}

export async function GlossaryDrawer({ entries }: Props) {
  const locale = await getLocale();

  return (
    <aside data-glossary-drawer className="self-start">
      <div className="rounded-lg border border-border bg-surface p-5">
        <Eyebrow>{t(locale, "reader.glossaryHeading")}</Eyebrow>
        {entries.length === 0 ? (
          <p className="mt-4 font-serif text-xs text-muted">
            {t(locale, "reader.glossaryEmpty")}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3.5">
            {entries.map((entry) => (
              <div
                key={`${entry.termJa}-${entry.category}`}
                className="border-b border-dashed border-border pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="break-keep font-serif text-base font-semibold leading-tight text-foreground">
                      {entry.termKo}
                    </span>
                    <span className="break-keep font-jp text-[12px] leading-tight text-muted">
                      {entry.termJa}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-[3px] border border-border-strong px-1.5 py-0.5 font-mono text-[9px] text-muted">
                    {t(locale, `glossary.${entry.category}`)}
                  </span>
                </div>
                {entry.notes ? (
                  <p className="mt-1.5 font-serif text-[11.5px] leading-relaxed text-secondary">
                    {entry.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
