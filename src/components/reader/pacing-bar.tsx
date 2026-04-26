"use client";

import { useEffect, useRef, useState } from "react";

interface PaceState {
  progress: number;
  pace: number;
  etaSeconds: number;
}

const SAMPLE_INTERVAL_MS = 3000;
const ASSUMED_CHARS_PER_PARAGRAPH = 80;

function computeProgress(): number {
  if (typeof window === "undefined") return 0;
  const doc = document.documentElement;
  const scroll = window.scrollY;
  const height = doc.scrollHeight - window.innerHeight;
  if (height <= 0) return 0;
  return Math.max(0, Math.min(1, scroll / height));
}

function totalParagraphs(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll("[data-reader-paragraph]").length;
}

export function PacingBar() {
  const [state, setState] = useState<PaceState>({ progress: 0, pace: 0, etaSeconds: 0 });
  const startedAtRef = useRef<number>(0);
  const initialProgressRef = useRef<number>(0);
  const prefersReducedRef = useRef<boolean>(false);

  useEffect(() => {
    initialProgressRef.current = computeProgress();
    startedAtRef.current = Date.now();
    prefersReducedRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frameId = 0;
    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        setState((prev) => ({ ...prev, progress: computeProgress() }));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const interval = setInterval(() => {
      const progress = computeProgress();
      const totalChars = totalParagraphs() * ASSUMED_CHARS_PER_PARAGRAPH;
      const charsRead = Math.floor(progress * totalChars);
      const initialChars = Math.floor(initialProgressRef.current * totalChars);
      const elapsedSeconds = (Date.now() - startedAtRef.current) / 1000;
      const charsDelta = Math.max(0, charsRead - initialChars);
      const pace = elapsedSeconds > 5 ? Math.round((charsDelta / elapsedSeconds) * 60) : 0;
      const remaining = Math.max(0, totalChars - charsRead);
      const etaSeconds = pace > 0 ? Math.round(remaining / (pace / 60)) : 0;
      setState({ progress, pace, etaSeconds });
    }, SAMPLE_INTERVAL_MS);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frameId);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="sticky top-0 z-10 h-[2px] w-full bg-surface-strong"
      aria-hidden="true"
    >
      <div
        className="h-full bg-accent transition-[width] duration-150"
        style={{ width: `${(state.progress * 100).toFixed(2)}%` }}
      />
    </div>
  );
}
