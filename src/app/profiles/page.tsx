"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

interface ProfileSummary {
  id: string;
  displayName: string;
  createdAt: string;
  isActive: boolean;
}

interface ProfilesResponse {
  activeProfileId: string | null;
  profiles: ProfileSummary[];
}

export default function ProfilesPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfilesResponse>({ activeProfileId: null, profiles: [] });
  const [displayName, setDisplayName] = useState("");
  const [importGuestData, setImportGuestData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  function notifyProfileChanged() {
    window.dispatchEvent(new Event("profile-changed"));
  }

  const loadProfiles = useCallback(async (options?: { showError?: boolean }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/profiles");
      if (!res.ok) {
        if (options?.showError !== false) {
          setFeedback({ tone: "error", message: t("profile.loadFailed") });
        }
        return;
      }
      const data = await res.json();
      setProfiles(data);
    } catch {
      if (options?.showError !== false) {
        setFeedback({ tone: "error", message: t("profile.loadFailed") });
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProfiles({ showError: true });
  }, [loadProfiles]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setCreating(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          importGuestData,
        }),
      });
      if (res.ok) {
        setDisplayName("");
        await loadProfiles({ showError: false });
        notifyProfileChanged();
        setFeedback({ tone: "success", message: t("profile.createSuccess") });
        router.refresh();
        return;
      }
      setFeedback({
        tone: "error",
        message: await readErrorMessage(res, t("profile.createFailed")),
      });
    } finally {
      setCreating(false);
    }
  }

  async function selectProfile(profileId: string) {
    setFeedback(null);
    setBusyProfileId(profileId);
    try {
      const res = await fetch("/api/profiles/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        await loadProfiles({ showError: false });
        notifyProfileChanged();
        setFeedback({ tone: "success", message: t("profile.switchSuccess") });
        router.refresh();
        return;
      }
      setFeedback({
        tone: "error",
        message: await readErrorMessage(res, t("profile.selectFailed")),
      });
    } finally {
      setBusyProfileId(null);
    }
  }

  async function useGuest() {
    setFeedback(null);
    setBusyProfileId("guest");
    try {
      const res = await fetch("/api/profiles/active", { method: "DELETE" });
      if (!res.ok) {
        setFeedback({
          tone: "error",
          message: await readErrorMessage(res, t("profile.useGuestFailed")),
        });
        return;
      }
      await loadProfiles({ showError: false });
      notifyProfileChanged();
      setFeedback({ tone: "success", message: t("profile.guestSuccess") });
      router.refresh();
    } finally {
      setBusyProfileId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {t("profile.title")}
        </h1>
        <p className="text-sm text-muted">
          {t("profile.subtitle")}
        </p>
      </div>

      <div
        aria-live="polite"
        className={`overflow-hidden transition-all duration-200 ${
          feedback ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback?.tone === "error"
              ? "border-error/30 bg-error/5 text-error"
              : "border-success/30 bg-success/5 text-success"
          }`}
        >
          {feedback?.message ?? "\u00A0"}
        </p>
      </div>

      <section className="surface-card space-y-5 rounded-xl p-6">
        <h2 className="text-lg font-normal">{t("profile.create")}</h2>

        <form className="space-y-4" onSubmit={handleCreate}>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("profile.namePlaceholder")}
            maxLength={120}
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
            required
          />

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={importGuestData}
              onChange={(event) => setImportGuestData(event.target.checked)}
            />
            <span>{t("profile.importGuestData")}</span>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="btn-pill btn-accent min-w-[7rem]"
          >
            {creating ? (
              <svg className="mx-auto h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : t("profile.create")}
          </button>
        </form>
      </section>

      <section className="surface-card space-y-5 rounded-xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-normal">{t("profile.listTitle")}</h2>
          <button
            type="button"
            onClick={useGuest}
            disabled={busyProfileId === "guest"}
            className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-strong hover:text-foreground disabled:opacity-50"
          >
            {t("profile.useGuest")}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted">{t("profile.loading")}</p>
        ) : profiles.profiles.length === 0 ? (
          <p className="text-sm text-muted">{t("profile.empty")}</p>
        ) : (
          <div className="space-y-2">
            {profiles.profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {profile.displayName}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {profile.isActive ? (
                  <span className="self-start rounded-full bg-success/10 px-3 py-1 text-xs text-success">
                    {t("profile.current")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => selectProfile(profile.id)}
                    disabled={busyProfileId === profile.id}
                    className="btn-pill btn-secondary self-start text-xs min-w-[5rem]"
                  >
                    {busyProfileId === profile.id ? (
                      <svg className="mx-auto h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : t("profile.select")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (
      typeof data.error === "string" &&
      data.error.length > 0 &&
      data.error !== "Validation failed" &&
      data.error !== "Invalid JSON body"
    ) {
      return data.error;
    }
  } catch {
    // Ignore parse errors and use fallback copy instead.
  }

  return fallback;
}
