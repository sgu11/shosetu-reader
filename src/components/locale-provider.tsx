"use client";

import { type ReactNode } from "react";
import { LocaleContext, type Locale } from "@/lib/i18n/client";

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
