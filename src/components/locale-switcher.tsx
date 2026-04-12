"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

export function LocaleSwitcher() {
  const router = useRouter();
  const { locale } = useTranslation();

  async function switchLocale(newLocale: string) {
    document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <div className="flex rounded-full border border-border p-0.5">
      <button
        type="button"
        onClick={() => switchLocale("en")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          locale === "en"
            ? "bg-surface-strong text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchLocale("ko")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          locale === "ko"
            ? "bg-surface-strong text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        KR
      </button>
    </div>
  );
}
