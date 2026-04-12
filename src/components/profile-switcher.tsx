"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

interface ActiveProfileResponse {
  activeProfileId: string | null;
  profile: {
    id: string;
    displayName: string;
  } | null;
}

export function ProfileSwitcher() {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeProfile, setActiveProfile] = useState<ActiveProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadActiveProfile() {
    setLoading(true);
    try {
      const res = await fetch("/api/profiles/active");
      const data = await res.json();
      setActiveProfile(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActiveProfile();

    function handleProfileChanged() {
      void loadActiveProfile();
    }

    window.addEventListener("profile-changed", handleProfileChanged);
    return () => window.removeEventListener("profile-changed", handleProfileChanged);
  }, []);

  async function switchToGuest() {
    await fetch("/api/profiles/active", { method: "DELETE" });
    setActiveProfile({ activeProfileId: null, profile: null });
    window.dispatchEvent(new Event("profile-changed"));
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-full border border-border px-3 py-1 text-xs text-transparent">
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">
        {activeProfile?.profile
          ? `${t("profile.active")}: ${activeProfile.profile.displayName}`
          : t("profile.guest")}
      </span>
      <Link href="/profiles" className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-strong hover:text-foreground">
        {t("profile.manage")}
      </Link>
      {activeProfile?.profile && (
        <button
          type="button"
          onClick={switchToGuest}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
        >
          {t("profile.useGuest")}
        </button>
      )}
    </div>
  );
}
