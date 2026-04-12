"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ModelOption {
  id: string;
  name: string;
  promptPrice: string | null;
  completionPrice: string | null;
}

interface GlossaryEntry {
  id: string;
  novelId: string;
  termJa: string;
  termKo: string;
  reading: string | null;
  category: string;
  notes: string | null;
  sourceEpisodeNumber: number | null;
  status: "confirmed" | "suggested" | "rejected";
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

type Category = "character" | "place" | "term" | "skill" | "honorific";
type FilterTab = "all" | Category;

interface Props {
  novelId: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CATEGORIES: Category[] = ["character", "place", "term", "skill", "honorific"];

// i18n: category display names — needs i18n keys later
const CATEGORY_LABELS: Record<Category, string> = {
  character: "Character",
  place: "Place",
  term: "Term",
  skill: "Skill",
  honorific: "Honorific",
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" }, // needs i18n
  ...CATEGORIES.map((c) => ({ key: c as FilterTab, label: CATEGORY_LABELS[c] })),
];

function categoryColor(cat: string): string {
  switch (cat) {
    case "character":
      return "bg-blue-500/15 text-blue-400";
    case "place":
      return "bg-emerald-500/15 text-emerald-400";
    case "term":
      return "bg-purple-500/15 text-purple-400";
    case "skill":
      return "bg-orange-500/15 text-orange-400";
    case "honorific":
      return "bg-pink-500/15 text-pink-400";
    default:
      return "bg-surface-strong text-muted";
  }
}

function statusBadge(status: string): { className: string; label: string } {
  switch (status) {
    case "confirmed":
      return { className: "bg-accent/15 text-accent", label: "Confirmed" }; // needs i18n
    case "suggested":
      return { className: "bg-yellow-500/15 text-yellow-400", label: "Suggested" }; // needs i18n
    case "rejected":
      return { className: "bg-surface-strong text-muted line-through", label: "Rejected" }; // needs i18n
    default:
      return { className: "bg-surface-strong text-muted", label: status };
  }
}

function formatCost(usd: number | null, locale: "en" | "ko"): string | null {
  if (usd == null) return null;
  if (locale === "ko") {
    const krw = usd * 1500;
    if (krw < 1) return `${krw.toFixed(2)}원`;
    return `${krw.toFixed(1)}원`;
  }
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NovelGlossaryEditor({ novelId }: Props) {
  const { t, locale } = useTranslation();

  // Section open/close
  const [open, setOpen] = useState(false);

  /* ---------- Structured entries state ---------- */
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

  // Add-entry form
  const [newTermJa, setNewTermJa] = useState("");
  const [newTermKo, setNewTermKo] = useState("");
  const [newReading, setNewReading] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("character");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  /* ---------- Style guide (free-text glossary) state ---------- */
  const [glossary, setGlossary] = useState("");
  const [meta, setMeta] = useState<{
    modelName: string | null;
    episodeCount: number | null;
    generatedAt: string | null;
  }>({ modelName: null, episodeCount: null, generatedAt: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);

  /* ---------- Model selector state ---------- */
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* ---------- Cost estimation ---------- */
  const [estimate, setEstimate] = useState<{
    episodeCount: number;
    inputChars: number;
  } | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                     */
  /* ---------------------------------------------------------------- */

  // Load structured entries
  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary/entries`);
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      // silent
    } finally {
      setEntriesLoading(false);
    }
  }, [novelId]);

  // Load style guide glossary + meta
  useEffect(() => {
    fetch(`/api/novels/${novelId}/glossary`)
      .then((res) => res.json())
      .then((data) => {
        setGlossary(data.glossary ?? "");
        setMeta({
          modelName: data.modelName ?? null,
          episodeCount: data.episodeCount ?? null,
          generatedAt: data.generatedAt ?? null,
        });
      })
      .catch(() => {});
  }, [novelId]);

  // Load entries on open
  useEffect(() => {
    if (open) loadEntries();
  }, [open, loadEntries]);

  // Load cost estimate
  useEffect(() => {
    fetch(`/api/novels/${novelId}/glossary?estimate=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.episodeCount != null) {
          setEstimate({
            episodeCount: data.episodeCount,
            inputChars: data.inputChars,
          });
        }
      })
      .catch(() => {});
  }, [novelId]);

  // Load user's default model
  useEffect(() => {
    fetch("/api/translation-settings")
      .then((res) => res.json())
      .then((data) => {
        if (!selectedModel) {
          setSelectedModel(data.modelName ?? "");
        }
      })
      .catch(() => {});
  }, [selectedModel]);

  // Load available models
  useEffect(() => {
    fetch("/api/openrouter/models")
      .then((res) => res.json())
      .then((data) => setModels(data.models ?? []))
      .catch(() => {});
  }, []);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    }
    if (modelPickerOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modelPickerOpen]);

  /* ---------------------------------------------------------------- */
  /*  Derived                                                          */
  /* ---------------------------------------------------------------- */

  const filteredModels = modelSearch.trim()
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
          m.name.toLowerCase().includes(modelSearch.toLowerCase()),
      )
    : models;

  const shortModel = (id: string) => id.split("/").pop() ?? id;

  const filteredEntries = useMemo(() => {
    if (filterTab === "all") return entries;
    return entries.filter((e) => e.category === filterTab);
  }, [entries, filterTab]);

  const estimatedCost = useMemo(() => {
    if (!estimate || estimate.episodeCount === 0 || !selectedModel) return null;
    const model = models.find((m) => m.id === selectedModel);
    if (!model?.promptPrice || !model?.completionPrice) return null;

    const promptPricePerToken = parseFloat(model.promptPrice);
    const completionPricePerToken = parseFloat(model.completionPrice);
    if (isNaN(promptPricePerToken) || isNaN(completionPricePerToken)) return null;

    const inputTokens = Math.ceil(estimate.inputChars / 3);
    const outputTokens = 2000;
    return inputTokens * promptPricePerToken + outputTokens * completionPricePerToken;
  }, [estimate, selectedModel, models]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const addEntry = useCallback(async () => {
    if (!newTermJa.trim() || !newTermKo.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termJa: newTermJa.trim(),
          termKo: newTermKo.trim(),
          category: newCategory,
          reading: newReading.trim() || undefined,
          notes: newNotes.trim() || undefined,
          status: "confirmed",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [data.entry, ...prev]);
        setNewTermJa("");
        setNewTermKo("");
        setNewReading("");
        setNewNotes("");
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  }, [novelId, newTermJa, newTermKo, newReading, newCategory, newNotes]);

  const updateEntryStatus = useCallback(
    async (entryId: string, status: "confirmed" | "rejected") => {
      try {
        const res = await fetch(`/api/novels/${novelId}/glossary/entries/${entryId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = await res.json();
          setEntries((prev) => prev.map((e) => (e.id === entryId ? data.entry : e)));
        }
      } catch {
        // silent
      }
    },
    [novelId],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      try {
        const res = await fetch(`/api/novels/${novelId}/glossary/entries/${entryId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== entryId));
        }
      } catch {
        // silent
      }
    },
    [novelId],
  );

  const saveStyleGuide = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/novels/${novelId}/glossary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glossary }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [novelId, glossary]);

  const generateGlossary = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Generation failed");
        return;
      }
      setGlossary(data.glossary ?? "");
      setMeta({
        modelName: data.modelName ?? null,
        episodeCount: data.episodeCount ?? null,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      alert("Network error");
    } finally {
      setGenerating(false);
    }
  }, [novelId, selectedModel]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <section className="surface-card space-y-3 rounded-xl p-6">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-base font-medium">{t("glossary.title")}</h2>
          <p className="text-xs text-muted">{t("glossary.subtitle")}</p>
        </div>
        <span className="text-muted">{open ? "\u25B2" : "\u25BC"}</span>
      </button>

      {open && (
        <div className="space-y-6 pt-2">
          {/* ============================================================ */}
          {/*  STRUCTURED ENTRIES                                           */}
          {/* ============================================================ */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {/* needs i18n: "Glossary entries" */}
              Glossary entries
              {!entriesLoading && (
                <span className="ml-2 text-xs font-normal text-muted">
                  ({filteredEntries.length})
                </span>
              )}
            </h3>

            {/* Add entry form */}
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_0.7fr_auto_1.2fr_auto] sm:items-end">
                <input
                  type="text"
                  value={newTermJa}
                  onChange={(e) => setNewTermJa(e.target.value)}
                  placeholder="原語 (JP)" // needs i18n
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                />
                <input
                  type="text"
                  value={newTermKo}
                  onChange={(e) => setNewTermKo(e.target.value)}
                  placeholder="번역 (KO)" // needs i18n
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                />
                <input
                  type="text"
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="読み" // needs i18n
                  className="hidden rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none sm:block"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Category)}
                  title="Category" // needs i18n
                  className="hidden rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-border-strong focus:outline-none sm:block"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notes" // needs i18n
                  className="hidden rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none sm:block"
                />
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={adding || !newTermJa.trim() || !newTermKo.trim()}
                  className="btn-pill btn-accent whitespace-nowrap px-4 py-2 text-xs"
                >
                  {/* needs i18n: "Add" */}
                  {adding ? "..." : "Add"}
                </button>
              </div>
              {/* Mobile-only: category + reading row */}
              <div className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-2 sm:hidden">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Category)}
                  title="Category" // needs i18n
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-border-strong focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newReading}
                  onChange={(e) => setNewReading(e.target.value)}
                  placeholder="読み"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                />
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Notes"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                />
              </div>
            </div>

            {/* Category filter tabs */}
            <div className="flex flex-wrap gap-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filterTab === tab.key
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface-strong text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Entries table */}
            {entriesLoading ? (
              <p className="py-4 text-center text-xs text-muted">Loading...</p>
            ) : filteredEntries.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">
                {/* needs i18n: "No entries yet" */}
                No entries yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="pb-2 pr-3 font-medium">
                        {/* needs i18n */}
                        Category
                      </th>
                      <th className="pb-2 pr-3 font-medium">JP</th>
                      <th className="pb-2 pr-3 font-medium">KO</th>
                      <th className="hidden pb-2 pr-3 font-medium sm:table-cell">
                        {/* needs i18n */}
                        Reading
                      </th>
                      <th className="hidden pb-2 pr-3 font-medium md:table-cell">
                        {/* needs i18n */}
                        Notes
                      </th>
                      <th className="pb-2 pr-3 font-medium">
                        {/* needs i18n */}
                        Status
                      </th>
                      <th className="pb-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const badge = statusBadge(entry.status);
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          {/* Category badge */}
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(entry.category)}`}
                            >
                              {CATEGORY_LABELS[entry.category as Category] ?? entry.category}
                            </span>
                          </td>
                          {/* JP term */}
                          <td className="py-2 pr-3 font-medium text-foreground">
                            {entry.termJa}
                          </td>
                          {/* KO term */}
                          <td className="py-2 pr-3 text-foreground">{entry.termKo}</td>
                          {/* Reading */}
                          <td className="hidden py-2 pr-3 text-muted sm:table-cell">
                            {entry.reading || "—"}
                          </td>
                          {/* Notes */}
                          <td className="hidden py-2 pr-3 text-xs text-muted md:table-cell">
                            {entry.notes || "—"}
                          </td>
                          {/* Status */}
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              {entry.status === "suggested" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => updateEntryStatus(entry.id, "confirmed")}
                                    className="rounded px-2 py-1 text-xs text-accent hover:bg-accent/10 transition-colors"
                                    title="Confirm" // needs i18n
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateEntryStatus(entry.id, "rejected")}
                                    className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-strong transition-colors"
                                    title="Reject" // needs i18n
                                  >
                                    ✗
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry.id)}
                                className="rounded px-2 py-1 text-xs text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete" // needs i18n
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* ============================================================ */}
          {/*  STYLE GUIDE (free-text)                                      */}
          {/* ============================================================ */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {/* needs i18n: "Style guide" */}
              Style guide
            </h3>

            {meta.generatedAt && (
              <p className="text-xs text-muted">
                {t("glossary.generatedInfo", {
                  episodes: meta.episodeCount ?? 0,
                  date: new Date(meta.generatedAt).toLocaleDateString(),
                })}
                {meta.modelName && (
                  <span className="ml-2 code-label">{shortModel(meta.modelName)}</span>
                )}
              </p>
            )}

            <textarea
              value={glossary}
              onChange={(e) => setGlossary(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
              placeholder={t("glossary.placeholder")}
            />

            {/* Model selector + cost estimate */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative" ref={pickerRef}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{t("glossary.model")}:</span>
                  <button
                    type="button"
                    onClick={() => setModelPickerOpen(!modelPickerOpen)}
                    className="code-label cursor-pointer hover:bg-surface-strong transition-colors"
                  >
                    {selectedModel ? shortModel(selectedModel) : "\u2014"}
                  </button>
                </div>

                {modelPickerOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-lg border border-border bg-surface p-2 shadow-lg">
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={t("settings.searchModels")}
                      className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredModels.slice(0, 30).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelPickerOpen(false);
                            setModelSearch("");
                          }}
                          className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-strong ${
                            selectedModel === m.id ? "text-accent" : "text-muted"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate">{m.name}</p>
                            <p className="truncate text-xs text-muted/60">{m.id}</p>
                          </div>
                        </button>
                      ))}
                      {filteredModels.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted">
                          {t("settings.noModelsFound")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {estimate && estimate.episodeCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{t("glossary.episodes", { count: estimate.episodeCount })}</span>
                  <span className="text-muted/40">|</span>
                  <span>
                    {t("glossary.estimatedCost")}:{" "}
                    <span className="text-foreground">
                      {estimatedCost != null
                        ? formatCost(estimatedCost, locale) ?? "\u2014"
                        : "\u2014"}
                    </span>
                  </span>
                </div>
              )}
              {estimate && estimate.episodeCount === 0 && (
                <span className="text-xs text-muted/60">{t("glossary.noEpisodes")}</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveStyleGuide}
                disabled={saving}
                className="btn-pill btn-accent text-xs"
              >
                {saving ? t("settings.saving") : t("settings.save")}
              </button>
              <button
                type="button"
                onClick={generateGlossary}
                disabled={generating || (estimate != null && estimate.episodeCount === 0)}
                className="btn-pill btn-secondary text-xs"
              >
                {generating ? t("glossary.generating") : t("glossary.generate")}
              </button>
              {saved && (
                <span className="text-xs text-accent">{t("settings.saved")}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
