"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  novelId: string;
}

export function IngestButton({ novelId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleIngest() {
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
        `Discovered ${data.discovered} new episodes. Fetched ${data.fetched}, failed ${data.failed}.`,
      );
      router.refresh();
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleIngest}
        disabled={loading}
        className="btn-pill btn-accent"
      >
        {loading ? "Ingesting..." : "Ingest episodes"}
      </button>
      {result && (
        <p className="text-xs text-muted">{result}</p>
      )}
    </div>
  );
}
