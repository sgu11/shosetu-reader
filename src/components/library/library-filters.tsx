"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

export type LibraryFilter = "all" | "reading" | "new" | "completed" | "pending";

interface Props {
  counts: Record<LibraryFilter, number>;
}

const FILTERS: Array<{ key: LibraryFilter; label: TranslationKey }> = [
  { key: "all", label: "library.filterAll" },
  { key: "reading", label: "library.filterReading" },
  { key: "new", label: "library.filterNew" },
  { key: "completed", label: "library.filterCompleted" },
  { key: "pending", label: "library.filterPending" },
];

export function LibraryFilters({ counts }: Props) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const current = (searchParams.get("filter") as LibraryFilter | null) ?? "all";

  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTERS.map((f) => {
        const active = current === f.key;
        const href = f.key === "all" ? "/library" : `/library?filter=${f.key}`;
        return (
          <Link
            key={f.key}
            href={href}
            className={`rounded-full px-3 py-1.5 text-[11.5px] transition-colors ${
              active
                ? "bg-deep text-accent-contrast"
                : "border border-border text-secondary hover:bg-surface-strong"
            }`}
          >
            {t(f.label)} {counts[f.key]}
          </Link>
        );
      })}
    </div>
  );
}
