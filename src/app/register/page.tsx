"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          Register a novel
        </h1>
        <p className="text-sm leading-7 text-muted">
          Paste a Syosetu URL or enter an ncode to add a novel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://ncode.syosetu.com/n1234ab/ or n1234ab"
          className="flex-1 rounded-md border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-pill btn-accent"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-error/30 bg-error/5 px-5 py-4 text-sm text-error">
          {error}
        </div>
      )}

      {result && (
        <div className="surface-card space-y-4 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              {result.isNew ? "Newly registered" : "Already registered"}
            </span>
            <span className="code-label">
              {result.novel.sourceNcode}
            </span>
          </div>

          <h2 className="text-xl font-normal">{result.novel.titleJa}</h2>

          {result.novel.authorName && (
            <p className="text-sm text-muted">by {result.novel.authorName}</p>
          )}

          {result.novel.summaryJa && (
            <p className="reader-text max-h-40 overflow-y-auto text-sm leading-7 text-muted">
              {result.novel.summaryJa}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted">
            {result.novel.totalEpisodes != null && (
              <span>{result.novel.totalEpisodes} episodes</span>
            )}
            {result.novel.isCompleted != null && (
              <span>{result.novel.isCompleted ? "Completed" : "Ongoing"}</span>
            )}
          </div>

          <button
            onClick={() => router.push(`/novels/${result.novel.id}`)}
            className="btn-pill btn-accent"
          >
            View novel details
          </button>
        </div>
      )}
    </main>
  );
}
