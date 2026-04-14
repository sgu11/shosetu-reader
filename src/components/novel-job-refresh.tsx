"use client";

import { useTranslation } from "@/lib/i18n/client";

interface Props {
  job: {
    id: string;
    jobType: string;
    status: string;
    result: {
      processed?: number | null;
      total?: number | null;
      fetched?: number | null;
      failed?: number | null;
      queued?: number | null;
    } | null;
  } | null;
}

export function NovelJobRefresh({ job }: Props) {
  const { t } = useTranslation();

  if (!job) {
    return null;
  }

  const processed = job.result?.processed ?? 0;
  const total = job.result?.total ?? 0;
  const progress = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;
  const accentLabel = job.jobType === "catalog.ingest-all"
    ? t("status.jobFetchAll")
    : job.jobType === "translation.bulk-translate-all"
      ? t("status.jobTranslateAll")
      : t("status.jobWorking");

  let detail = "";
  if (job.jobType === "catalog.ingest-all") {
    detail = t("status.fetchedCount", { count: job.result?.fetched ?? 0 });
    if ((job.result?.failed ?? 0) > 0) {
      detail += `, ${t("status.failedCount", { count: job.result?.failed ?? 0 })}`;
    }
  } else if (job.jobType === "translation.bulk-translate-all") {
    detail = t("status.queuedCount", { count: job.result?.queued ?? 0 });
    if ((job.result?.failed ?? 0) > 0) {
      detail += `, ${t("status.failedCount", { count: job.result?.failed ?? 0 })}`;
    }
  } else if (job.jobType === "glossary.generate") {
    detail = t("status.jobWorking");
  }

  return (
    <div aria-live="polite" className="space-y-2 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">{accentLabel}</p>
          <p className="text-xs text-muted">{t("status.liveUpdating")}</p>
        </div>
        {total > 0 && (
          <span className="text-xs text-muted">
            {processed}/{total}
          </span>
        )}
      </div>
      {progress != null && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {detail && (
        <p className="text-xs text-muted">
          {detail}
        </p>
      )}
    </div>
  );
}
