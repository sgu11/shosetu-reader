"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n/client";
import { ThemeToggle } from "@/components/theme-toggle";

interface ModelOption {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: string | null;
  completionPrice: string | null;
}

export default function SettingsPage() {
  const { t } = useTranslation();

  // Translation settings
  const [modelName, setModelName] = useState("");
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [defaultGlobalPrompt, setDefaultGlobalPrompt] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelSearch, setModelSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings
  useEffect(() => {
    fetch("/api/translation-settings")
      .then((res) => res.json())
      .then((data) => {
        setModelName(data.modelName ?? "");
        setGlobalPrompt(data.globalPrompt ?? "");
        setDefaultGlobalPrompt(data.defaultGlobalPrompt ?? "");
      })
      .catch(() => {});
  }, []);

  // Load models
  useEffect(() => {
    setModelsLoading(true);
    fetch("/api/openrouter/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models ?? []);
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, []);

  const filteredModels = modelSearch.trim()
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
          m.name.toLowerCase().includes(modelSearch.toLowerCase()),
      )
    : models;

  const saveSettings = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/translation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelName, globalPrompt }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [modelName, globalPrompt]);

  function applyDefaultPrompt() {
    setGlobalPrompt(defaultGlobalPrompt);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-normal leading-none tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted">
          {t("settings.translationConfig")}
        </p>
      </div>

      {/* Theme */}
      <section className="surface-card space-y-4 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-normal">{t("settings.themeSection")}</h2>
            <p className="text-xs text-muted">{t("settings.themeSectionDesc")}</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      {/* Model selection */}
      <section className="surface-card space-y-4 rounded-xl p-6">
        <h2 className="text-lg font-normal">{t("settings.translationModel")}</h2>
        <p className="text-xs text-muted">{t("settings.translationModelDesc")}</p>

        {/* Current model display */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-foreground">{t("settings.currentModel")}:</span>
          <span className="code-label">{modelName || "—"}</span>
        </div>

        {/* Model search & picker */}
        <div className="space-y-2">
          <input
            type="text"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder={t("settings.searchModels")}
            className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
          />

          {modelsLoading ? (
            <p className="text-xs text-muted">{t("settings.loadingModels")}</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {filteredModels.slice(0, 50).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModelName(m.id);
                    setModelSearch("");
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-strong ${
                    modelName === m.id
                      ? "bg-surface-strong text-accent"
                      : "text-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted">{m.id}</p>
                  </div>
                  {m.contextLength && (
                    <span className="ml-3 shrink-0 text-xs text-muted">
                      {Math.round(m.contextLength / 1000)}k ctx
                    </span>
                  )}
                </button>
              ))}
              {filteredModels.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted">{t("settings.noModelsFound")}</p>
              )}
              {filteredModels.length > 50 && (
                <p className="px-4 py-2 text-xs text-muted">
                  {t("settings.refineSearch")}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Global translation prompt */}
      <section className="surface-card space-y-4 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-normal">{t("settings.globalPrompt")}</h2>
            <p className="text-xs text-muted">{t("settings.globalPromptDesc")}</p>
          </div>
          <button
            type="button"
            onClick={applyDefaultPrompt}
            className="btn-pill btn-secondary text-xs"
          >
            {t("settings.useDefault")}
          </button>
        </div>

        <textarea
          value={globalPrompt}
          onChange={(e) => setGlobalPrompt(e.target.value)}
          rows={14}
          className="w-full rounded-md border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
          placeholder={t("settings.globalPromptPlaceholder")}
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="btn-pill btn-accent min-w-[5rem]"
        >
          {saving ? (
            <svg className="mx-auto h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : t("settings.save")}
        </button>
        <span className={`text-sm text-accent transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}>
          {t("settings.saved")}
        </span>
      </div>
    </main>
  );
}
