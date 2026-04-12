"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "@/lib/i18n/client";

interface TranslationState {
  status: "not_requested" | "queued" | "processing" | "available" | "failed";
  translatedText: string | null;
  modelName: string | null;
}

interface Props {
  episodeId: string;
  initialTranslation: TranslationState | null;
  configuredModel: string;
}

export function TranslationToggle({ episodeId, initialTranslation, configuredModel }: Props) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<"ja" | "ko">(
    initialTranslation?.status === "available" ? "ko" : "ja",
  );
  const [translation, setTranslation] = useState<TranslationState>(
    initialTranslation ?? { status: "not_requested", translatedText: null, modelName: null },
  );
  const [requesting, setRequesting] = useState(false);
  const [autoSwitchOnComplete, setAutoSwitchOnComplete] = useState(false);

  const hasTranslation = translation.status === "available";
  const isTranslating = translation.status === "queued" || translation.status === "processing";
  const isFailed = translation.status === "failed";
  const displayModel = translation.modelName ?? configuredModel;
  const shortModel = displayModel.split("/").pop() ?? displayModel;

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
      });
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
        // Auto-switch to KR when translation completes from a user-initiated request
        if (status === "available" && autoSwitchOnComplete) {
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isTranslating, pollStatus, autoSwitchOnComplete]);

  async function requestTranslation() {
    if (requesting || isTranslating) return;
    setRequesting(true);
    setAutoSwitchOnComplete(true);
    try {
      const res = await fetch(
        `/api/translations/episodes/${episodeId}/request`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setTranslation((prev) => ({
          ...prev,
          status: data.status,
          modelName: prev.modelName,
        }));
        // If it returned an existing available translation, switch immediately
        if (data.status === "available") {
          await pollStatus();
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        }
        // Otherwise, the poll interval will handle the switch when translation completes
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
    if (lang === "ko" && !hasTranslation) return; // KR is dimmed, no-op
    setLanguage(lang);
  }

  // Show/hide the translated vs original text via DOM visibility
  useEffect(() => {
    const readerEl = document.querySelector("[data-reader-text]") as HTMLElement | null;
    const originalEl = document.querySelector("[data-original-text]") as HTMLElement | null;

    if (!readerEl || !originalEl) return;

    if (language === "ko" && hasTranslation && translation.translatedText) {
      // Build translated paragraphs safely using textContent (no innerHTML)
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

      {/* Translate button — shown when no translation or failed */}
      {(!hasTranslation && !isTranslating) && (
        <button
          type="button"
          onClick={requestTranslation}
          disabled={requesting}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {isFailed ? t("translation.failedRetry") : t("translation.translate")}
          <span className="text-accent/60">{shortModel}</span>
        </button>
      )}

      {/* Translating indicator */}
      {isTranslating && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {t("translation.translating")}
        </span>
      )}

      {/* Model info when translation is available */}
      {hasTranslation && translation.modelName && (
        <span className="text-xs text-muted/60" title={translation.modelName}>
          {shortModel}
        </span>
      )}
    </div>
  );
}
