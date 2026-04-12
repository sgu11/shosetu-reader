"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n/client";

interface TranslationState {
  status: "not_requested" | "queued" | "processing" | "available" | "failed";
  translatedText: string | null;
  modelName: string | null;
  errorMessage: string | null;
}

interface AvailableTranslation {
  id: string;
  modelName: string;
  completedAt: string | null;
}

interface Props {
  episodeId: string;
  initialTranslation: TranslationState | null;
  configuredModel: string;
  availableTranslations: AvailableTranslation[];
}

export function TranslationToggle({
  episodeId,
  initialTranslation,
  configuredModel,
  availableTranslations: initialAvailable,
}: Props) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<"ja" | "ko">(
    initialTranslation?.status === "available" ? "ko" : "ja",
  );
  const [translation, setTranslation] = useState<TranslationState>(
    initialTranslation ?? { status: "not_requested", translatedText: null, modelName: null, errorMessage: null },
  );
  const [available, setAvailable] = useState<AvailableTranslation[]>(initialAvailable);
  const [requesting, setRequesting] = useState(false);
  const [autoSwitchOnComplete, setAutoSwitchOnComplete] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const hasTranslation = translation.status === "available";
  const isTranslating = translation.status === "queued" || translation.status === "processing";
  const isFailed = translation.status === "failed";
  const isRateLimited = isFailed && (translation.errorMessage?.includes("429") || translation.errorMessage?.includes("rate-limit"));
  const displayModel = translation.modelName ?? configuredModel;
  const shortModel = displayModel.split("/").pop() ?? displayModel;

  // Close model menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    if (modelMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelMenuOpen]);

  const pollStatus = useCallback(async () => {
    const res = await fetch(
      `/api/translations/episodes/${episodeId}/status`,
    );
    if (res.ok) {
      const data = await res.json();
      setTranslation({
        status: data.status,
        translatedText: data.translatedText,
        modelName: data.modelName,
        errorMessage: data.errorMessage ?? null,
      });
      // Update available translations list
      if (data.translations) {
        setAvailable(
          data.translations
            .filter((tr: { status: string }) => tr.status === "available")
            .map((tr: { id: string; modelName: string; completedAt: string | null }) => ({
              id: tr.id,
              modelName: tr.modelName,
              completedAt: tr.completedAt,
            })),
        );
      }
      return data.status;
    }
    return null;
  }, [episodeId]);

  // Poll while queued/processing
  useEffect(() => {
    if (!isTranslating) return;

    const interval = setInterval(async () => {
      const status = await pollStatus();
      if (status === "available" || status === "failed") {
        clearInterval(interval);
        if (status === "available" && autoSwitchOnComplete) {
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isTranslating, pollStatus, autoSwitchOnComplete]);

  async function requestTranslation(modelOverride?: string) {
    if (requesting || isTranslating) return;
    setRequesting(true);
    setAutoSwitchOnComplete(true);
    try {
      const res = await fetch(
        `/api/translations/episodes/${episodeId}/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(modelOverride ? { modelName: modelOverride } : {}),
        },
      );
      if (res.ok) {
        const data = await res.json();
        setTranslation((prev) => ({
          ...prev,
          status: data.status,
          errorMessage: null,
        }));
        if (data.status === "available") {
          await pollStatus();
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        }
      } else {
        setAutoSwitchOnComplete(false);
        setRequesting(false);
      }
    } catch {
      setAutoSwitchOnComplete(false);
      setRequesting(false);
    }
  }

  function handleToggle(lang: "ja" | "ko") {
    if (lang === "ko" && !hasTranslation) return;
    setLanguage(lang);
  }

  // Switch to a specific model's translation
  async function switchToModel(modelName: string) {
    setModelMenuOpen(false);
    // Fetch the full translation text for this model
    const res = await fetch(`/api/translations/episodes/${episodeId}/status`);
    if (!res.ok) return;
    const data = await res.json();
    const record = data.translations?.find(
      (tr: { modelName: string; status: string }) => tr.modelName === modelName && tr.status === "available",
    );
    if (record) {
      setTranslation({
        status: "available",
        translatedText: record.translatedText,
        modelName: record.modelName,
        errorMessage: null,
      });
      setLanguage("ko");
    }
  }

  // Show/hide the translated vs original text via DOM visibility
  useEffect(() => {
    const readerEl = document.querySelector("[data-reader-text]") as HTMLElement | null;
    const originalEl = document.querySelector("[data-original-text]") as HTMLElement | null;

    if (!readerEl || !originalEl) return;

    if (language === "ko" && hasTranslation && translation.translatedText) {
      while (readerEl.firstChild) {
        readerEl.removeChild(readerEl.firstChild);
      }
      const paragraphs = translation.translatedText.split("\n");
      for (const line of paragraphs) {
        const p = document.createElement("p");
        if (line.trim() === "") {
          p.className = "h-6";
        }
        p.textContent = line;
        readerEl.appendChild(p);
      }
      originalEl.classList.add("hidden");
      readerEl.classList.remove("hidden");
    } else {
      readerEl.classList.add("hidden");
      originalEl.classList.remove("hidden");
    }
  }, [language, hasTranslation, translation.translatedText]);

  const hasMultipleModels = available.length > 1;
  // Models that differ from current — for re-translate suggestions
  const otherModels = available.filter((a) => a.modelName !== displayModel);

  return (
    <div className="flex items-center gap-2">
      {/* Language tabs */}
      <div className="flex rounded-full border border-border p-0.5">
        <button
          type="button"
          onClick={() => handleToggle("ja")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            language === "ja"
              ? "bg-surface-strong text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          JA
        </button>
        <button
          type="button"
          onClick={() => handleToggle("ko")}
          disabled={!hasTranslation}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            language === "ko"
              ? "bg-surface-strong text-foreground"
              : hasTranslation
                ? "text-muted hover:text-foreground"
                : "text-muted/30 cursor-not-allowed"
          }`}
        >
          KR
        </button>
      </div>

      {/* Translate / Retry button — shown when no translation and not translating */}
      {!hasTranslation && !isTranslating && !isRateLimited && (
        <button
          type="button"
          onClick={() => requestTranslation()}
          disabled={requesting}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {isFailed ? t("translation.failedRetry") : t("translation.translate")}
          <span className="text-accent/60">{shortModel}</span>
        </button>
      )}

      {/* Rate-limited alert — show error with suggestion to change model */}
      {isRateLimited && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/5 px-3 py-1 text-xs font-medium text-warning">
            {t("translation.rateLimited")}
          </span>
          <button
            type="button"
            onClick={() => requestTranslation()}
            disabled={requesting}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground hover:bg-surface-strong disabled:opacity-50"
          >
            {t("translation.failedRetry")}
          </button>
        </div>
      )}

      {/* Translating indicator */}
      {isTranslating && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {t("translation.translating")}
          <span className="text-muted/60">{shortModel}</span>
        </span>
      )}

      {/* Model selector + re-translate — when translation is available */}
      {hasTranslation && (
        <div className="relative flex items-center gap-1.5" ref={modelMenuRef}>
          {/* Current model badge / dropdown trigger */}
          <button
            type="button"
            onClick={() => setModelMenuOpen(!modelMenuOpen)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
            title={displayModel}
          >
            {shortModel}
            {(hasMultipleModels || true) && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {/* Dropdown menu */}
          {modelMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-1.5 space-y-0.5">
              {/* Available translations from other models */}
              {available.map((tr) => {
                const isActive = tr.modelName === translation.modelName;
                const short = tr.modelName.split("/").pop() ?? tr.modelName;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => switchToModel(tr.modelName)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors ${
                      isActive
                        ? "bg-surface-strong text-foreground"
                        : "text-muted hover:text-foreground hover:bg-surface-strong"
                    }`}
                  >
                    <span className="truncate">{short}</span>
                    {isActive && (
                      <span className="ml-2 shrink-0 text-accent">&#10003;</span>
                    )}
                  </button>
                );
              })}

              {available.length > 0 && (
                <div className="my-1 border-t border-border" />
              )}

              {/* Re-translate with configured model */}
              {(!translation.modelName || translation.modelName !== configuredModel || otherModels.length === 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen(false);
                    requestTranslation(configuredModel);
                  }}
                  disabled={requesting || isTranslating}
                  className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left text-xs text-accent transition-colors hover:bg-surface-strong disabled:opacity-50"
                >
                  {t("translation.retranslate")}
                  <span className="text-accent/60">
                    {configuredModel.split("/").pop()}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
