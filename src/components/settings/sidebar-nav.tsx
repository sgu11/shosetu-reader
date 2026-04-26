"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

export type SettingsSection = "account" | "reading" | "translation" | "data";

interface Props {
  current: SettingsSection;
}

const SECTIONS: Array<{ id: SettingsSection; label: TranslationKey }> = [
  { id: "account", label: "settings.sectionAccount" },
  { id: "reading", label: "settings.sectionReading" },
  { id: "translation", label: "settings.sectionTranslation" },
  { id: "data", label: "settings.sectionData" },
];

export function SidebarNav({ current }: Props) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  return (
    <nav
      className="flex flex-row gap-1 overflow-x-auto border-b border-border pb-2 md:flex-col md:gap-0 md:overflow-visible md:border-b-0 md:border-r md:pb-0 md:pr-6"
      aria-label="Settings sections"
    >
      {SECTIONS.map((section) => {
        const active = current === section.id;
        const params = new URLSearchParams(searchParams);
        params.set("section", section.id);
        return (
          <Link
            key={section.id}
            href={`/settings?${params.toString()}`}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap py-2 text-sm transition-colors md:-mr-[25px] md:pr-3.5 ${
              active
                ? "font-medium italic text-foreground md:border-r-2 md:border-accent md:font-serif md:text-base md:not-italic"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {t(section.label)}
          </Link>
        );
      })}
    </nav>
  );
}
