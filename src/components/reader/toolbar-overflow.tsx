"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ToolbarOverflow({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      <div className="hidden items-center gap-2 sm:flex">{children}</div>

      <div className="relative sm:hidden" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More controls"
          className="rounded-full border border-border px-2.5 py-1 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>⋯</span>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-2 flex flex-col items-stretch gap-2 rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}
