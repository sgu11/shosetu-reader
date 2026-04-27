"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const SHOW_THRESHOLD_PX = 80;
const SCROLL_DELTA_PX = 6;

export function StickyToolbar({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < SCROLL_DELTA_PX) return;

      if (dy > 0 && y > SHOW_THRESHOLD_PX) {
        setHidden(true);
      } else if (dy < 0) {
        setHidden(false);
      }
      lastY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm transition-transform duration-200 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {children}
    </nav>
  );
}
