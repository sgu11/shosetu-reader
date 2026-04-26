"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/client";

type Theme = "paper" | "sepia" | "night" | "system";

const CYCLE: Record<Theme, Theme> = {
  paper: "sepia",
  sepia: "night",
  night: "system",
  system: "paper",
};

function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") return "system";
  const v = document.documentElement.getAttribute("data-theme");
  if (v === "paper" || v === "sepia" || v === "night") return v;
  return "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribeToTheme(callback: () => void) {
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

const ICONS: Record<Theme, string> = {
  paper: "☀",
  sepia: "◑",
  night: "☽",
  system: "◐",
};

const LABELS: Record<
  Theme,
  "settings.themePaper" | "settings.themeSepia" | "settings.themeNight" | "settings.themeSystem"
> = {
  paper: "settings.themePaper",
  sepia: "settings.themeSepia",
  night: "settings.themeNight",
  system: "settings.themeSystem",
};

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    applyTheme(CYCLE[theme]);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
      aria-label={t("settings.toggleTheme")}
    >
      <span aria-hidden>{ICONS[theme]}</span>
      <span>{t(LABELS[theme])}</span>
    </button>
  );
}
