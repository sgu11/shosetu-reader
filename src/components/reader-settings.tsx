"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n/client";

interface ReaderPrefs {
  fontSize: string;
  lineHeight: string;
  contentWidth: string;
  fontFamily: string;
  fontWeight: string;
}

const COOKIE_NAME = "reader-prefs";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

function readPrefsCookie(): Partial<ReaderPrefs> | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function writePrefsCookie(prefs: ReaderPrefs) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(prefs))};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

const FONT_SIZES = [
  { value: "small", label: "14px", px: 14 },
  { value: "medium", label: "16px", px: 16 },
  { value: "large", label: "18px", px: 18 },
  { value: "xlarge", label: "20px", px: 20 },
];

const LINE_HEIGHTS = [
  { value: "1.6", label: "1.6" },
  { value: "1.8", label: "1.8" },
  { value: "2.0", label: "2.0" },
  { value: "2.2", label: "2.2" },
];

const CONTENT_WIDTHS = [
  { value: "560", label: "560px" },
  { value: "680", label: "680px" },
  { value: "800", label: "800px" },
];

const FONT_FAMILIES = [
  { value: "newsreader", label: "Newsreader", css: "var(--font-newsreader), Georgia, serif" },
  { value: "noto-serif-jp", label: "Noto Serif JP", css: "var(--font-jp-serif), 'Noto Serif JP', serif" },
  { value: "pretendard", label: "Pretendard", css: "'Pretendard JP Variable', 'Pretendard JP', system-ui, sans-serif" },
];

const FONT_WEIGHTS = [
  { value: "normal", label: "Normal", css: "400" },
  { value: "bold", label: "Bold", css: "700" },
  { value: "extrabold", label: "Extra Bold", css: "800" },
];

function applyReaderStyles(prefs: ReaderPrefs) {
  const fontPx = FONT_SIZES.find((f) => f.value === prefs.fontSize)?.px ?? 16;
  const fontCss = FONT_FAMILIES.find((f) => f.value === prefs.fontFamily)?.css ?? "var(--font-newsreader), Georgia, serif";
  const weightCss = FONT_WEIGHTS.find((w) => w.value === prefs.fontWeight)?.css ?? "400";
  document.documentElement.style.setProperty("--reader-font-size", `${fontPx}px`);
  document.documentElement.style.setProperty("--reader-line-height", prefs.lineHeight);
  document.documentElement.style.setProperty("--reader-content-width", `${prefs.contentWidth}px`);
  document.documentElement.style.setProperty("--reader-font-family", fontCss);
  document.documentElement.style.setProperty("--reader-font-weight", weightCss);
}

export function ReaderSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>({
    fontSize: "medium",
    lineHeight: "1.8",
    contentWidth: "800",
    fontFamily: "newsreader",
    fontWeight: "normal",
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load current settings from cookie
  useEffect(() => {
    const saved = readPrefsCookie();
    if (saved) {
      const loaded: ReaderPrefs = {
        fontSize: saved.fontSize ?? "medium",
        lineHeight: saved.lineHeight ?? "1.8",
        contentWidth: saved.contentWidth ?? "800",
        fontFamily: saved.fontFamily ?? "newsreader",
        fontWeight: saved.fontWeight ?? "normal",
      };
      applyReaderStyles(loaded);
      const frame = requestAnimationFrame(() => {
        setPrefs(loaded);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function save(updated: ReaderPrefs) {
    setPrefs(updated);
    applyReaderStyles(updated);
    writePrefsCookie(updated);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
        aria-label={t("settings.readerSettings")}
      >
        Aa
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-4 space-y-4">
          {/* Font family */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">
              {t("settings.fontFamily")}
            </label>
            <div className="flex flex-col gap-1">
              {FONT_FAMILIES.map((ff) => (
                <button
                  key={ff.value}
                  type="button"
                  onClick={() => save({ ...prefs, fontFamily: ff.value })}
                  className={`rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                    prefs.fontFamily === ff.value
                      ? "bg-surface-strong text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                  style={{ fontFamily: ff.css }}
                >
                  {ff.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font weight */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">
              {t("settings.fontWeight")}
            </label>
            <div className="flex gap-1">
              {FONT_WEIGHTS.map((fw) => (
                <button
                  key={fw.value}
                  type="button"
                  onClick={() => save({ ...prefs, fontWeight: fw.value })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    prefs.fontWeight === fw.value
                      ? "bg-surface-strong text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {fw.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">
              {t("settings.fontSize")}
            </label>
            <div className="flex gap-1">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => save({ ...prefs, fontSize: size.value })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    prefs.fontSize === size.value
                      ? "bg-surface-strong text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Line height */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">
              {t("settings.lineHeight")}
            </label>
            <div className="flex gap-1">
              {LINE_HEIGHTS.map((lh) => (
                <button
                  key={lh.value}
                  type="button"
                  onClick={() => save({ ...prefs, lineHeight: lh.value })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    prefs.lineHeight === lh.value
                      ? "bg-surface-strong text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content width */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted">
              {t("settings.contentWidth")}
            </label>
            <div className="flex gap-1">
              {CONTENT_WIDTHS.map((cw) => (
                <button
                  key={cw.value}
                  type="button"
                  onClick={() => save({ ...prefs, contentWidth: cw.value })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    prefs.contentWidth === cw.value
                      ? "bg-surface-strong text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {cw.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
