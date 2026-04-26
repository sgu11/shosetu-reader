"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

type Theme = "paper" | "sepia" | "night" | "system";

interface Swatch {
  value: Theme;
  label: TranslationKey;
  background: string;
}

const SWATCHES: Swatch[] = [
  {
    value: "system",
    label: "settings.themeSystem",
    background: "linear-gradient(90deg, #faf6ef 50%, #14110d 50%)",
  },
  { value: "paper", label: "settings.themePaper", background: "#faf6ef" },
  { value: "sepia", label: "settings.themeSepia", background: "#f1e2c7" },
  { value: "night", label: "settings.themeNight", background: "#14110d" },
];

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "system";
  const v = document.documentElement.getAttribute("data-theme");
  if (v === "paper" || v === "sepia" || v === "night") return v;
  return "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.cookie = "theme=;path=/;max-age=0;SameSite=Lax";
  } else {
    document.cookie = `theme=${theme};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
  }
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemePicker() {
  const { t } = useTranslation();
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex flex-wrap gap-2.5">
      {SWATCHES.map((s) => {
        const active = current === s.value;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => applyTheme(s.value)}
            className={`w-20 rounded-md p-2 transition-colors ${
              active
                ? "border-2 border-accent"
                : "border border-border-strong hover:border-foreground"
            }`}
          >
            <div
              className="mb-1.5 h-8 rounded-[3px] border border-border-subtle"
              style={{ background: s.background }}
            />
            <div className="text-center text-[11px] text-secondary">
              {t(s.label)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
