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
  { value: "noto-serif-jp", label: "Noto Serif JP", css: "'Noto Serif JP', serif" },
  { value: "nanum-myeongjo", label: "Nanum Myeongjo", css: "'Nanum Myeongjo', serif" },
  { value: "nanum-gothic", label: "Nanum Gothic", css: "'Nanum Gothic', sans-serif" },
  { value: "pretendard", label: "Pretendard", css: "'Pretendard JP Variable', 'Pretendard JP', system-ui, sans-serif" },
];

const FONT_WEIGHTS = [
  { value: "normal", label: "Normal", css: "400" },
  { value: "bold", label: "Bold", css: "700" },
];

export function ReaderSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>({
    fontSize: "medium",
    lineHeight: "1.8",
    contentWidth: "680",
    fontFamily: "noto-serif-jp",
    fontWeight: "normal",
  });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load current settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.reader) {
          const loaded: ReaderPrefs = {
            fontSize: data.reader.fontSize ?? "medium",
            lineHeight: data.reader.lineHeight ?? "1.8",
            contentWidth: data.reader.contentWidth ?? "680",
            fontFamily: data.reader.fontFamily ?? "noto-serif-jp",
            fontWeight: data.reader.fontWeight ?? "normal",
          };
          setPrefs(loaded);
          applyStyles(loaded);
        }
      })
      .catch(() => {});
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

  function applyStyles(p: ReaderPrefs) {
    const fontPx = FONT_SIZES.find((f) => f.value === p.fontSize)?.px ?? 16;
    const fontCss = FONT_FAMILIES.find((f) => f.value === p.fontFamily)?.css ?? "'Noto Serif JP', serif";
    const weightCss = FONT_WEIGHTS.find((w) => w.value === p.fontWeight)?.css ?? "400";
    document.documentElement.style.setProperty("--reader-font-size", `${fontPx}px`);
    document.documentElement.style.setProperty("--reader-line-height", p.lineHeight);
    document.documentElement.style.setProperty("--reader-content-width", `${p.contentWidth}px`);
    document.documentElement.style.setProperty("--reader-font-family", fontCss);
    document.documentElement.style.setProperty("--reader-font-weight", weightCss);
  }

  async function save(updated: ReaderPrefs) {
    setPrefs(updated);
    applyStyles(updated);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reader: updated }),
      });
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
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

          {saving && (
            <p className="text-center text-xs text-muted">{t("settings.saving")}</p>
          )}
        </div>
      )}
    </div>
  );
}
