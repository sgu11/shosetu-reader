"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  href: string;
  match: RegExp;
  label: TranslationKey;
}

const NAV: NavItem[] = [
  { href: "/", match: /^\/$/, label: "nav.home" },
  { href: "/library", match: /^\/library/, label: "nav.library" },
  { href: "/ranking", match: /^\/ranking/, label: "nav.ranking" },
  { href: "/register", match: /^\/register/, label: "nav.register" },
  { href: "/settings", match: /^\/settings/, label: "nav.settings" },
  { href: "/profiles", match: /^\/profiles/, label: "nav.profiles" },
];

function MastheadDate({ locale }: { locale: "en" | "ko" }) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yyyy = now.getFullYear();
  const edition = locale === "ko" ? "KO EDITION" : "EN EDITION";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
      {mm} · {dd} · {yyyy} — {edition}
    </span>
  );
}

export function Masthead() {
  const { t, locale } = useTranslation();
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-2 px-6 py-3 md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <div className="hidden md:block">
          <MastheadDate locale={locale} />
        </div>

        <Link href="/" className="text-center">
          <div className="font-serif text-[22px] italic font-medium leading-tight tracking-tight text-foreground">
            Narou <span className="not-italic text-accent">·</span> Reader
          </div>
          <div className="font-jp text-[9px] tracking-[0.3em] text-muted">
            なろう リーダー · 나로우 리더
          </div>
        </Link>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-end"
          aria-label="primary"
        >
          {NAV.map((item) => {
            const active = item.match.test(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`pb-0.5 font-sans text-xs transition-colors ${
                  active
                    ? "border-b-[1.5px] border-accent font-semibold text-foreground"
                    : "border-b-[1.5px] border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-6 pb-3">
        <ProfileSwitcher />
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
    </header>
  );
}
