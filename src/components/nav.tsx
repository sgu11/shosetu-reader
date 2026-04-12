"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/client";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function Nav() {
  const { t } = useTranslation();

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/library", label: t("nav.library") },
    { href: "/ranking", label: t("nav.ranking") },
    { href: "/register", label: t("nav.register") },
  ] as const;

  return (
    <nav className="border-b border-border bg-background px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            {t("nav.brand")}
          </Link>
          <div className="flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link
            href="/register"
            className="btn-pill btn-primary text-xs"
          >
            {t("nav.addNovel")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
