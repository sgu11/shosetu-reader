"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n/client";

interface ReaderPrefs {
  fontSize: string;
  lineHeight: string;
  contentWidth: string;
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

export function ReaderSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReaderPrefs>({
    fontSize: "medium",
    lineHeight: "1.8",
    contentWidth: "680",
  });
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load current settings
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.reader) {
          setPrefs({
            fontSize: data.reader.fontSize ?? "medium",
            lineHeight: data.reader.lineHeight ?? "1.8",
            contentWidth: data.reader.contentWidth ?? "680",
          });
          applyStyles({
            fontSize: data.reader.fontSize ?? "medium",
            lineHeight: data.reader.lineHeight ?? "1.8",
            contentWidth: data.reader.contentWidth ?? "680",
          });
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
    document.documentElement.style.setProperty("--reader-font-size", `${fontPx}px`);
    document.documentElement.style.setProperty("--reader-line-height", p.lineHeight);
    document.documentElement.style.setProperty("--reader-content-width", `${p.contentWidth}px`);
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
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-4 space-y-4">
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
