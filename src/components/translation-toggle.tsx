"use client";

import { useState, useCallback, useEffect } from "react";

interface TranslationState {
  status: "not_requested" | "queued" | "processing" | "available" | "failed";
  translatedText: string | null;
}

interface Props {
  episodeId: string;
  initialTranslation: TranslationState | null;
}

export function TranslationToggle({ episodeId, initialTranslation }: Props) {
  const [language, setLanguage] = useState<"ja" | "ko">(
    initialTranslation?.status === "available" ? "ko" : "ja",
  );
  const [translation, setTranslation] = useState<TranslationState>(
    initialTranslation ?? { status: "not_requested", translatedText: null },
  );
  const [requesting, setRequesting] = useState(false);

  const pollStatus = useCallback(async () => {
    const res = await fetch(
      `/api/translations/episodes/${episodeId}/status`,
    );
    if (res.ok) {
      const data = await res.json();
      setTranslation({
        status: data.status,
        translatedText: data.translatedText,
      });
      return data.status;
    }
    return null;
  }, [episodeId]);

  // Poll while queued/processing
  useEffect(() => {
    if (
      translation.status !== "queued" &&
      translation.status !== "processing"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      const status = await pollStatus();
      if (status === "available" || status === "failed") {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [translation.status, pollStatus]);

  async function requestTranslation() {
    setRequesting(true);
    try {
      const res = await fetch(
        `/api/translations/episodes/${episodeId}/request`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setTranslation((prev) => ({ ...prev, status: data.status }));
      }
    } catch {
      // silent
    } finally {
      setRequesting(false);
    }
  }

  function handleToggle(lang: "ja" | "ko") {
    if (lang === "ko" && translation.status === "not_requested") {
      requestTranslation();
    }
    setLanguage(lang);
  }

  // Show/hide the translated vs original text via DOM visibility
  useEffect(() => {
    const readerEl = document.querySelector("[data-reader-text]") as HTMLElement | null;
    const originalEl = document.querySelector("[data-original-text]") as HTMLElement | null;

    if (!readerEl || !originalEl) return;

    if (language === "ko" && translation.status === "available" && translation.translatedText) {
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
  }, [language, translation.status, translation.translatedText]);

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
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            language === "ko"
              ? "bg-surface-strong text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          KR
        </button>
      </div>

      {/* Status indicator */}
      {translation.status === "queued" || translation.status === "processing" ? (
        <span className="text-xs text-muted">Translating...</span>
      ) : translation.status === "failed" ? (
        <button
          type="button"
          onClick={requestTranslation}
          disabled={requesting}
          className="text-xs text-error hover:underline"
        >
          Failed — retry
        </button>
      ) : null}
    </div>
  );
}
