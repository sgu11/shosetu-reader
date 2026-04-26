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
  styleGuide: string | null;
}

export async function GlossaryDrawer({ entries, styleGuide }: Props) {
  const locale = await getLocale();

  return (
    <aside className="no-scrollbar overflow-y-auto border-l border-border bg-surface p-6">
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
              className="border-b border-dashed border-border pb-3 last:border-b-0"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-jp text-base font-semibold text-foreground">
                  {entry.termJa}
                </span>
                <span className="font-serif text-[13px] italic text-secondary">
                  {entry.termKo}
                </span>
                <span className="ml-auto rounded-[3px] border border-border-strong px-1.5 py-0.5 font-mono text-[9px] text-muted">
                  {t(locale, `glossary.${entry.category}`)}
                </span>
              </div>
              {entry.notes ? (
                <p className="mt-1 font-serif text-[11.5px] leading-relaxed text-secondary">
                  {entry.notes}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {styleGuide ? (
        <div className="mt-5 rounded-lg bg-surface-strong p-3">
          <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted">
            {t(locale, "reader.styleGuideHeading")}
          </div>
          <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-secondary">
            {styleGuide}
          </p>
        </div>
      ) : null}
    </aside>
  );
}
