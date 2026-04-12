"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

interface Props {
  novelId: string;
}

export function IngestButton({ novelId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [translateMenuOpen, setTranslateMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const translateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (translateMenuRef.current && !translateMenuRef.current.contains(e.target as Node)) {
        setTranslateMenuOpen(false);
      }
    }
    if (menuOpen || translateMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen, translateMenuOpen]);

  async function handleIngest() {
    setMenuOpen(false);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/novels/${novelId}/ingest?limit=10`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }

      setResult(
        t("ingest.result", {
          discovered: data.discovered,
          fetched: data.fetched,
          failed: data.failed,
        }),
      );
      router.refresh();
    } catch {
      setResult(t("ingest.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleIngestAll() {
    setMenuOpen(false);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/novels/${novelId}/ingest-all`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }

      setResult(
        t("ingest.ingestAllStarted", { discovered: data.discovered }),
      );
      // Refresh after a short delay to show initial progress
      setTimeout(() => router.refresh(), 3000);
    } catch {
      setResult(t("ingest.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkTranslate() {
    setTranslateMenuOpen(false);
    setTranslating(true);
    setResult(null);

    try {
      const res = await fetch(`/api/novels/${novelId}/bulk-translate?limit=10`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }

      if (data.queued === 0) {
        setResult(t("ingest.bulkTranslateNone"));
      } else {
        setResult(t("ingest.bulkTranslateResult", { queued: data.queued }));
      }
      router.refresh();
    } catch {
      setResult(t("ingest.networkError"));
    } finally {
      setTranslating(false);
    }
  }

  async function handleBulkTranslateAll() {
    setTranslateMenuOpen(false);
    setTranslating(true);
    setResult(null);

    try {
      const res = await fetch(`/api/novels/${novelId}/bulk-translate-all`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setResult(`Error: ${data.error}`);
        return;
      }

      if (data.total === 0) {
        setResult(t("ingest.bulkTranslateNone"));
      } else {
        setResult(t("ingest.bulkTranslateAllStarted", { total: data.total }));
      }
      setTimeout(() => router.refresh(), 3000);
    } catch {
      setResult(t("ingest.networkError"));
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Ingest dropdown */}
        <div className="relative" ref={menuRef}>
          <div className="flex">
            <button
              type="button"
              onClick={handleIngest}
              disabled={loading}
              className="btn-pill btn-accent rounded-r-none border-r border-r-accent-contrast/20"
            >
              {loading ? t("ingest.ingesting") : t("ingest.ingest")}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              disabled={loading}
              className="btn-pill btn-accent rounded-l-none px-2"
              aria-label="More ingest options"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {menuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1">
              <button
                type="button"
                onClick={handleIngest}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
              >
                {t("ingest.ingest")}
              </button>
              <button
                type="button"
                onClick={handleIngestAll}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
              >
                {t("ingest.ingestAll")}
              </button>
            </div>
          )}
        </div>

        {/* Bulk translate dropdown */}
        <div className="relative" ref={translateMenuRef}>
          <div className="flex">
            <button
              type="button"
              onClick={handleBulkTranslate}
              disabled={translating}
              className="btn-pill btn-secondary rounded-r-none border-r border-r-border-strong"
            >
              {translating
                ? t("ingest.bulkTranslating")
                : t("ingest.bulkTranslate", { count: 10 })}
            </button>
            <button
              type="button"
              onClick={() => setTranslateMenuOpen(!translateMenuOpen)}
              disabled={translating}
              className="btn-pill btn-secondary rounded-l-none px-2"
              aria-label="More translate options"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {translateMenuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1">
              <button
                type="button"
                onClick={handleBulkTranslate}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
              >
                {t("ingest.bulkTranslate", { count: 10 })}
              </button>
              <button
                type="button"
                onClick={handleBulkTranslateAll}
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
              >
                {t("ingest.bulkTranslateAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {result && (
        <p className="text-xs text-muted">{result}</p>
      )}
    </div>
  );
}
