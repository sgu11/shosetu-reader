import Link from "next/link";
import { getLocale, t } from "@/lib/i18n";

interface ContinueTop {
  novelId: string;
  episodeId: string;
  episodeNumber: number;
  titleJa: string;
  titleKo: string | null;
}

interface Props {
  continueTop?: ContinueTop;
}

function getIssue(): { issue: string; year: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return { issue: `${year}-${String(month).padStart(2, "0")}`, year };
}

export async function HomeHero({ continueTop }: Props) {
  const locale = await getLocale();
  const { issue, year } = getIssue();

  return (
    <section className="grid gap-12 px-14 pb-7 pt-12 md:grid-cols-[1.4fr_1fr] md:items-end">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          {t(locale, "home.heroVolume", { issue, year })}
        </div>
        <h1 className="mb-4 mt-3 font-serif text-5xl font-normal leading-[0.95] tracking-tight text-foreground md:text-7xl lg:text-[84px]">
          <span className="italic">{t(locale, "home.heroTagline")}</span>
          <br />
          <span className="text-accent">{t(locale, "home.heroTaglineEm")}</span>{" "}
          {t(locale, "home.heroTaglineSuffix")}
        </h1>
        <p className="m-0 max-w-[520px] font-serif text-base leading-relaxed text-secondary md:text-[17px]">
          {t(locale, "home.heroSubtitle")}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {continueTop ? (
            <Link
              href={`/reader/${continueTop.episodeId}`}
              className="btn-pill btn-primary inline-flex items-center gap-2 text-[13px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t(locale, "home.heroContinueWith")}
              <span className="font-mono text-[10px] opacity-60">
                #{continueTop.episodeNumber}{" "}
                {locale === "ko" && continueTop.titleKo
                  ? continueTop.titleKo
                  : continueTop.titleJa}
              </span>
            </Link>
          ) : (
            <Link href="/library" className="btn-pill btn-primary text-[13px]">
              {t(locale, "home.myLibrary")}
            </Link>
          )}
          <Link href="/register" className="btn-pill btn-secondary text-[13px]">
            {t(locale, "home.addNovel")} +
          </Link>
        </div>
      </div>
    </section>
  );
}
