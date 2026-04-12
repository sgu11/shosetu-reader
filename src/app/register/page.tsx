"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

interface RegisterResult {
  novel: {
    id: string;
    sourceNcode: string;
    titleJa: string;
    authorName: string | null;
    summaryJa: string | null;
    totalEpisodes: number | null;
    isCompleted: boolean | null;
  };
  isNew: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/novels/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed");
        return;
      }

      setResult(data);
    } catch {
      setError(t("register.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {t("register.title")}
        </h1>
        <p className="text-sm leading-7 text-muted">
          {t("register.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("register.placeholder")}
          className="flex-1 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-pill btn-accent min-w-[6rem]"
        >
          {loading ? (
            <svg className="mx-auto h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : t("register.submit")}
        </button>
      </form>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          error ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-error/30 bg-error/5 px-5 py-4 text-sm text-error">
          {error ?? "\u00A0"}
        </div>
      </div>

      {result && (
        <div className="surface-card space-y-4 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {result.isNew ? t("register.newlyRegistered") : t("register.alreadyRegistered")}
            </span>
            <span className="code-label">
              {result.novel.sourceNcode}
            </span>
          </div>

          <h2 className="text-xl font-normal">{result.novel.titleJa}</h2>

          {result.novel.authorName && (
            <p className="text-sm text-muted">{t("register.by")} {result.novel.authorName}</p>
          )}

          {result.novel.summaryJa && (
            <p className="reader-text max-h-40 overflow-y-auto text-sm leading-7 text-muted">
              {result.novel.summaryJa}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted">
            {result.novel.totalEpisodes != null && (
              <span>{result.novel.totalEpisodes} {t("register.episodes")}</span>
            )}
            {result.novel.isCompleted != null && (
              <span>{result.novel.isCompleted ? t("register.completed") : t("register.ongoing")}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => router.push(`/novels/${result.novel.id}`)}
            className="btn-pill btn-accent"
          >
            {t("register.viewDetails")}
          </button>
        </div>
      )}
    </main>
  );
}
