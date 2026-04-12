"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

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
  estimatedCostUsd?: number | null;
}

function formatCost(usd: number | null | undefined, locale: "en" | "ko"): string | null {
  if (usd == null) return null;
  if (locale === "ko") {
    const krw = usd * 1500;
    return `${krw.toFixed(1)}원`;
  }
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatDuration(ms: number, locale: "en" | "ko") {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return locale === "ko"
      ? `${minutes}분 ${seconds}초`
      : `${minutes}m ${seconds}s`;
  }

  return locale === "ko"
    ? `${seconds}초`
    : `${seconds}s`;
}

interface PendingTranslation {
  status: "queued" | "processing";
  modelName: string;
  progressEstimate: {
    progressPercent: number;
    estimatedRemainingMs: number;
    estimatedTotalMs: number;
    elapsedMs: number;
    confidence: "low" | "medium" | "high";
    sampleCount: number;
  } | null;
}

interface Props {
  episodeId: string;
  initialTranslation: TranslationState | null;
  initialLanguage: "ja" | "ko";
  configuredModel: string;
  availableTranslations: AvailableTranslation[];
  pendingTranslation: PendingTranslation | null;
}

export function TranslationToggle({
  episodeId,
  initialTranslation,
  initialLanguage,
  configuredModel,
  availableTranslations: initialAvailable,
  pendingTranslation: initialPendingTranslation,
}: Props) {
  const { t, locale } = useTranslation();
  const [language, setLanguage] = useState<"ja" | "ko">(
    initialLanguage === "ko" && initialTranslation?.status === "available" ? "ko" : "ja",
  );
  const [translation, setTranslation] = useState<TranslationState>(
    initialTranslation ?? { status: "not_requested", translatedText: null, modelName: null, errorMessage: null },
  );
  const [available, setAvailable] = useState<AvailableTranslation[]>(initialAvailable);
  const [pendingTranslation, setPendingTranslation] = useState<PendingTranslation | null>(
    initialPendingTranslation,
  );
  const [requesting, setRequesting] = useState(false);
  const [autoSwitchOnComplete, setAutoSwitchOnComplete] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "info" | "error"; message: string } | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const hasTranslation = translation.status === "available";
  const isTranslating = pendingTranslation != null || translation.status === "queued" || translation.status === "processing";
  const isFailed = translation.status === "failed";
  const isRateLimited = isFailed && (translation.errorMessage?.includes("429") || translation.errorMessage?.includes("rate-limit"));
  const displayModel = translation.modelName ?? configuredModel;
  const shortModel = displayModel.split("/").pop() ?? displayModel;
  const configuredShortModel = configuredModel.split("/").pop() ?? configuredModel;
  const pendingShortModel = pendingTranslation?.modelName.split("/").pop() ?? null;

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
      setPendingTranslation(data.pendingTranslation ?? null);
      // Update available translations list
      if (data.translations) {
        setAvailable(
          data.translations
            .filter((tr: { status: string }) => tr.status === "available")
            .map((tr: { id: string; modelName: string; completedAt: string | null; estimatedCostUsd?: number | null }) => ({
              id: tr.id,
              modelName: tr.modelName,
              completedAt: tr.completedAt,
              estimatedCostUsd: tr.estimatedCostUsd ?? null,
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
      if (status === "available" || status === "failed" || status === "not_requested") {
        clearInterval(interval);
        if (status === "available" && autoSwitchOnComplete) {
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        } else if (status !== "available") {
          setAutoSwitchOnComplete(false);
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
    setFeedback(null);
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
        setPendingTranslation({
          status: data.status === "processing" ? "processing" : "queued",
          modelName: modelOverride ?? configuredModel,
          progressEstimate: null,
        });
        setTranslation((prev) => {
          if (prev.status === "available" && data.status !== "available") {
            return {
              ...prev,
              errorMessage: null,
            };
          }

          return {
            ...prev,
            status: data.status,
            errorMessage: null,
          };
        });
        if (data.status === "available") {
          await pollStatus();
          setAutoSwitchOnComplete(false);
          setLanguage("ko");
          setRequesting(false);
        }
      } else {
        setFeedback({
          tone: "error",
          message: await readErrorMessage(res, t("translation.requestFailed")),
        });
        setAutoSwitchOnComplete(false);
        setRequesting(false);
      }
    } catch {
      setFeedback({ tone: "error", message: t("translation.requestFailed") });
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
    setFeedback(null);
    // Fetch the full translation text for this model
    const res = await fetch(`/api/translations/episodes/${episodeId}/status`);
    if (!res.ok) {
      setFeedback({ tone: "error", message: t("translation.loadFailed") });
      return;
    }
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
      return;
    }

    setFeedback({ tone: "error", message: t("translation.loadFailed") });
  }

  async function discardTranslation(translationId: string) {
    const confirmed = window.confirm(t("translation.confirmDiscardSingle"));
    if (!confirmed) {
      return;
    }

    const res = await fetch(`/api/translations/episodes/${episodeId}/discard`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translationId }),
    });

    if (!res.ok) {
      setFeedback({
        tone: "error",
        message: await readErrorMessage(res, t("translation.discardFailed")),
      });
      return;
    }

    setFeedback({ tone: "info", message: t("translation.discardSuccess") });
    const status = await pollStatus();
    if (status !== "available") {
      setLanguage("ja");
    }
  }

  // Show/hide the translated vs original text via DOM visibility
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("reader-language-change", {
        detail: { language },
      }),
    );
  }, [language]);

  useEffect(() => {
    const readerEl = document.querySelector("[data-reader-text]") as HTMLElement | null;
    const originalEl = document.querySelector("[data-original-text]") as HTMLElement | null;

    if (!readerEl || !originalEl) return;

    if (language === "ko" && hasTranslation && translation.translatedText) {
      while (readerEl.firstChild) {
        readerEl.removeChild(readerEl.firstChild);
      }
      const paragraphs = translation.translatedText.split("\n");
      for (const [index, line] of paragraphs.entries()) {
        const p = document.createElement("p");
        if (line.trim() === "") {
          p.className = "h-6";
        }
        p.dataset.readerParagraph = `p-${index}`;
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

  // Models that differ from current — for re-translate suggestions
  const otherModels = available.filter((a) => a.modelName !== displayModel);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 min-h-[2rem]">
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
                  : "cursor-not-allowed text-muted/30"
            }`}
          >
            KR
          </button>
        </div>

        {isRateLimited && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/5 px-3 py-1 text-xs font-medium text-warning">
            {t("translation.rateLimited")}
          </span>
        )}

        <div className="relative flex items-center gap-1.5" ref={modelMenuRef}>
          <button
            type="button"
            onClick={() => setModelMenuOpen(!modelMenuOpen)}
            disabled={requesting}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
              !hasTranslation && !isTranslating
                ? "border border-accent/30 bg-accent/5 font-medium text-accent hover:bg-accent/10"
                : "border border-border text-muted hover:bg-surface-strong hover:text-foreground"
            }`}
            title={displayModel}
          >
            {isTranslating ? (
              <>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <span className="hidden sm:inline">{t("translation.translating")}</span>
                <span className="hidden sm:inline text-muted/60">{pendingShortModel ?? shortModel}</span>
              </>
            ) : (
              <>
                <span className={!hasTranslation ? "text-accent/70" : "text-muted/70"}>
                  {!hasTranslation
                    ? (isFailed ? t("translation.failedRetry") : t("translation.translate"))
                    : t("translation.model")}
                </span>
                <span className="hidden sm:inline">{shortModel}</span>
              </>
            )}
            <svg className={`h-3 w-3 transition-transform ${modelMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {modelMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 space-y-1 rounded-lg border border-border bg-surface p-1.5">
              {!hasTranslation && !isTranslating && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuOpen(false);
                      requestTranslation(configuredModel);
                    }}
                    disabled={requesting}
                    className="flex w-full items-center gap-1.5 rounded-md bg-accent/10 px-3 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
                    title={configuredModel}
                  >
                    {isFailed ? t("translation.failedRetry") : t("translation.translate")}
                    <span className="text-accent/60">{configuredShortModel}</span>
                  </button>
                  <div className="border-t border-border" />
                </>
              )}

              <div className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted">
                <div>{t("translation.currentModel")}</div>
                <div className="mt-1 truncate text-foreground" title={displayModel}>
                  {displayModel}
                </div>
              </div>

              {available.length > 0 ? (
                available.map((tr) => {
                  const isActive = tr.modelName === translation.modelName;
                  const short = tr.modelName.split("/").pop() ?? tr.modelName;

                  return (
                    <div
                      key={tr.id}
                      className={`flex items-center gap-1 rounded-md px-1 py-1 ${
                        isActive ? "bg-surface-strong" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => switchToModel(tr.modelName)}
                        className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? "text-foreground"
                            : "text-muted hover:bg-surface-strong hover:text-foreground"
                        }`}
                        title={tr.modelName}
                      >
                        <span className="truncate">{short}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-1.5">
                          {formatCost(tr.estimatedCostUsd, locale) && (
                            <span className="text-muted/50">{formatCost(tr.estimatedCostUsd, locale)}</span>
                          )}
                          {isActive && <span className="text-accent">&#10003;</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => discardTranslation(tr.id)}
                        className="rounded-md px-2 py-2 text-xs text-error transition-colors hover:bg-error/5"
                        title={t("translation.discardSingle")}
                      >
                        {t("translation.discardShort")}
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="px-3 py-2 text-xs text-muted">
                  {t("translation.noSavedTranslations")}
                </p>
              )}

              <div className="border-t border-border" />

              {hasTranslation && (!translation.modelName || translation.modelName !== configuredModel || otherModels.length === 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setModelMenuOpen(false);
                    requestTranslation(configuredModel);
                  }}
                  disabled={requesting || isTranslating}
                  className="flex w-full items-center gap-1.5 rounded-md px-3 py-2 text-left text-xs text-accent transition-colors hover:bg-surface-strong disabled:opacity-50"
                  title={configuredModel}
                >
                  {t("translation.retranslate")}
                  <span className="text-accent/60">{configuredShortModel}</span>
                </button>
              )}

              <Link
                href="/settings"
                className="block rounded-md px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
              >
                {t("translation.openSettings")}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div
        aria-live="polite"
        className={`overflow-hidden transition-all duration-200 ${
          feedback ? "max-h-6 opacity-100 mt-1" : "max-h-0 opacity-0"
        }`}
      >
        <p
          className={`text-xs ${
            feedback?.tone === "error" ? "text-error" : "text-muted"
          }`}
        >
          {feedback?.message ?? "\u00A0"}
        </p>
      </div>

      {pendingTranslation?.status === "processing" && pendingTranslation.progressEstimate && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 space-y-1 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              {t("translation.etaLabel")}{" "}
              {formatDuration(pendingTranslation.progressEstimate.estimatedRemainingMs, locale)}
            </span>
            <span>{getConfidenceLabel(t, pendingTranslation.progressEstimate.confidence)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pendingTranslation.progressEstimate.progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore parse errors and fall back to local copy.
  }

  return fallback;
}

function getConfidenceLabel(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  confidence: "low" | "medium" | "high",
) {
  switch (confidence) {
    case "high":
      return t("translation.confidenceHigh");
    case "medium":
      return t("translation.confidenceMedium");
    case "low":
      return t("translation.confidenceLow");
  }
}
