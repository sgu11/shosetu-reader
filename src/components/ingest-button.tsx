"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";

interface Props {
  novelId: string;
}

export function IngestButton({ novelId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<"info" | "success" | "error">("info");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isBusy = busy || activeJobId != null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function reconnectActiveJob() {
      try {
        const res = await fetch(`/api/novels/${novelId}/jobs/current`);
        if (!res.ok) {
          return;
        }

        const data = await res.json();
        if (!cancelled && data.job?.id) {
          setActiveJobId(data.job.id);
          setResult(t("ingest.jobRestored"));
          setResultTone("info");
        }
      } catch {
        // silent
      }
    }

    if (!activeJobId) {
      void reconnectActiveJob();
    }

    return () => {
      cancelled = true;
    };
  }, [activeJobId, novelId, t]);

  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    const interval = setInterval(async () => {
      const res = await fetch(`/api/jobs/${activeJobId}`);
      if (!res.ok) {
        return;
      }

      const job = await res.json();
      const nextMessage = formatJobMessage(job, t);
      if (nextMessage) {
        setResult(nextMessage);
        setResultTone(job.status === "failed" ? "error" : job.status === "completed" ? "success" : "info");
      }

      if (job.status === "completed" || job.status === "failed") {
        clearInterval(interval);
        setActiveJobId(null);
        router.refresh();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId, router, t]);

  async function run(action: () => Promise<void>) {
    setMenuOpen(false);
    setBusy(true);
    setResult(null);
    setResultTone("info");
    try {
      await action();
    } catch {
      setResult(t("ingest.requestFailed"));
      setResultTone("error");
    } finally {
      setBusy(false);
    }
  }

  const handleIngest = () =>
    run(async () => {
      const res = await fetch(`/api/novels/${novelId}/ingest?limit=10`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : t("ingest.requestFailed"));
        setResultTone("error");
        return;
      }
      setResult(t("ingest.result", { discovered: data.discovered, fetched: data.fetched, failed: data.failed }));
      setResultTone("success");
      router.refresh();
    });

  const handleIngestAll = () =>
    run(async () => {
      const res = await fetch(`/api/novels/${novelId}/ingest-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : t("ingest.requestFailed"));
        setResultTone("error");
        return;
      }
      setResult(t("ingest.ingestAllStarted", { discovered: data.discovered }));
      setResultTone("info");
      setActiveJobId(data.jobId);
    });

  const handleBulkTranslate = () =>
    run(async () => {
      const res = await fetch(`/api/novels/${novelId}/bulk-translate?limit=10`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : t("ingest.requestFailed"));
        setResultTone("error");
        return;
      }
      if (data.queued === 0) {
        setResult(t("ingest.bulkTranslateNone"));
        setResultTone("info");
      } else {
        setResult(t("ingest.bulkTranslateResult", { queued: data.queued }));
        setResultTone("success");
      }
      router.refresh();
    });

  const handleBulkTranslateAll = () =>
    run(async () => {
      const res = await fetch(`/api/novels/${novelId}/bulk-translate-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : t("ingest.requestFailed"));
        setResultTone("error");
        return;
      }
      if (data.total === 0) {
        setResult(t("ingest.bulkTranslateNone"));
        setResultTone("info");
      } else {
        setResult(t("ingest.bulkTranslateAllStarted", { total: data.total }));
        setResultTone("info");
      }
      if (data.jobId) {
        setActiveJobId(data.jobId);
      }
    });

  const handleReingestAll = () =>
    run(async () => {
      const confirmed = window.confirm(t("ingest.reingestConfirm"));
      if (!confirmed) return;
      const res = await fetch(`/api/novels/${novelId}/reingest-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(typeof data.error === "string" ? data.error : t("ingest.requestFailed"));
        setResultTone("error");
        return;
      }
      if (data.reset === 0) {
        setResult(t("ingest.reingestNone"));
        setResultTone("info");
        return;
      }
      setResult(t("ingest.reingestAllStarted", { reset: data.reset }));
      setResultTone("info");
      setActiveJobId(data.jobId);
    });

  const handleAbortTranslation = () =>
    run(async () => {
      const res = await fetch(`/api/novels/${novelId}/translate-session/abort`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error === "No active translation session" ? t("ingest.noActiveSession") : t("ingest.abortFailed"));
        setResultTone("error");
        return;
      }
      setResult(t("ingest.abortSuccess"));
      setResultTone("info");
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="relative inline-block" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isBusy}
          className="btn-pill btn-secondary gap-1.5 min-w-[7rem]"
        >
          {isBusy ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          )}
          {isBusy ? t("ingest.ingesting") : t("ingest.actions")}
          <svg className={`h-3.5 w-3.5 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-border bg-surface p-1">
            <p className="px-3 py-1.5 text-xs font-medium text-muted/60">{t("ingest.ingestGroup")}</p>
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
            <button
              type="button"
              onClick={handleReingestAll}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:text-foreground hover:bg-surface-strong"
            >
              {t("ingest.reingestAll")}
            </button>

            <div className="my-1 border-t border-border" />

            <p className="px-3 py-1.5 text-xs font-medium text-muted/60">{t("ingest.translateGroup")}</p>
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

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={handleAbortTranslation}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
            >
              {t("ingest.abortTranslation")}
            </button>
          </div>
        )}
      </div>

      <div
        aria-live="polite"
        className={`overflow-hidden transition-all duration-200 ${
          result ? "max-h-10 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p
          className={`text-xs ${
            resultTone === "error"
              ? "text-error"
              : resultTone === "success"
                ? "text-success"
                : "text-muted"
          }`}
        >
          {result ?? "\u00A0"}
        </p>
      </div>
    </div>
  );
}

function formatJobMessage(
  job: {
    jobType: string;
    status: string;
    result?: Record<string, unknown> | null;
  },
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string | null {
  const result = job.result ?? {};
  const processed = Number(result.processed ?? 0);
  const total = Number(result.total ?? 0);

  if (job.jobType === "catalog.ingest-all") {
    if (job.status === "completed") {
      return t("ingest.result", {
        discovered: Number(result.discovered ?? 0),
        fetched: Number(result.fetched ?? 0),
        failed: Number(result.failed ?? 0),
      });
    }

    if (job.status === "failed") {
      return t("ingest.backgroundFailed");
    }

    return t("ingest.ingestAllProgress", {
      processed,
      total,
      fetched: Number(result.fetched ?? 0),
      failed: Number(result.failed ?? 0),
    });
  }

  if (job.jobType === "translation.bulk-translate-all") {
    if (job.status === "completed") {
      return t("ingest.bulkTranslateAllProgress", {
        processed: total,
        total,
        queued: Number(result.queued ?? 0),
        failed: Number(result.failed ?? 0),
      });
    }

    if (job.status === "failed") {
      return t("ingest.backgroundFailed");
    }

    return t("ingest.bulkTranslateAllProgress", {
      processed,
      total,
      queued: Number(result.queued ?? 0),
      failed: Number(result.failed ?? 0),
    });
  }

  return null;
}
