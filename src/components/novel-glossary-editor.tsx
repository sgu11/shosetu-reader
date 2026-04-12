"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "@/lib/i18n/client";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

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
  importance: number;
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

const CATEGORY_I18N_KEYS: Record<Category, TranslationKey> = {
  character: "glossary.character",
  place: "glossary.place",
  term: "glossary.term",
  skill: "glossary.skill",
  honorific: "glossary.honorific",
};

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

function importanceStars(level: number): string {
  return "★".repeat(Math.min(level, 5)) + "☆".repeat(Math.max(0, 5 - level));
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

const PAGE_SIZE = 30;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NovelGlossaryEditor({ novelId }: Props) {
  const { t, locale } = useTranslation();

  const categoryLabel = useCallback(
    (cat: Category) => t(CATEGORY_I18N_KEYS[cat]),
    [t],
  );

  const filterTabs = useMemo(
    () => [
      { key: "all" as FilterTab, label: t("glossary.all") },
      ...CATEGORIES.map((c) => ({ key: c as FilterTab, label: categoryLabel(c) })),
    ],
    [t, categoryLabel],
  );

  // Section open/close
  const [open, setOpen] = useState(false);

  /* ---------- Structured entries state ---------- */
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(0);

  // Add-entry form
  const [newTermJa, setNewTermJa] = useState("");
  const [newTermKo, setNewTermKo] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("character");
  const [adding, setAdding] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTermJa, setEditTermJa] = useState("");
  const [editTermKo, setEditTermKo] = useState("");
  const [editCategory, setEditCategory] = useState<Category>("character");
  const [editImportance, setEditImportance] = useState(3);
  const [editSaving, setEditSaving] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  /*  Toast helper                                                     */
  /* ---------------------------------------------------------------- */

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                     */
  /* ---------------------------------------------------------------- */

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary/entries`);
      if (!res.ok) throw new Error("Failed to load entries");
      const data = await res.json();
      setEntries(data.entries ?? []);
    } catch {
      showToast("Failed to load glossary entries", "error");
    } finally {
      setEntriesLoading(false);
    }
  }, [novelId, showToast]);

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

  useEffect(() => {
    if (open) loadEntries();
  }, [open, loadEntries]);

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

  useEffect(() => {
    fetch("/api/openrouter/models")
      .then((res) => res.json())
      .then((data) => setModels(data.models ?? []))
      .catch(() => {});
  }, []);

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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedEntries = filteredEntries.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  // Per-category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entries.length };
    for (const e of entries) {
      counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

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

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [filterTab]);

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
          status: "confirmed",
          importance: 3,
        }),
      });
      if (!res.ok) throw new Error("Failed to add entry");
      const data = await res.json();
      setEntries((prev) => [data.entry, ...prev]);
      setNewTermJa("");
      setNewTermKo("");
      showToast(t("glossary.entryAdded"), "success");
    } catch {
      showToast(t("glossary.entryAddFailed"), "error");
    } finally {
      setAdding(false);
    }
  }, [novelId, newTermJa, newTermKo, newCategory, showToast, t]);

  const startEdit = useCallback((entry: GlossaryEntry) => {
    setEditingId(entry.id);
    setEditTermJa(entry.termJa);
    setEditTermKo(entry.termKo);
    setEditCategory(entry.category as Category);
    setEditImportance(entry.importance ?? 3);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editTermJa.trim() || !editTermKo.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary/entries/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termJa: editTermJa.trim(),
          termKo: editTermKo.trim(),
          category: editCategory,
          importance: editImportance,
        }),
      });
      if (!res.ok) throw new Error("Failed to update entry");
      const data = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === editingId ? data.entry : e)));
      setEditingId(null);
      showToast(t("glossary.entryUpdated"), "success");
    } catch {
      showToast(t("glossary.entryUpdateFailed"), "error");
    } finally {
      setEditSaving(false);
    }
  }, [novelId, editingId, editTermJa, editTermKo, editCategory, editImportance, showToast, t]);

  const deleteEntry = useCallback(
    async (entryId: string) => {
      try {
        const res = await fetch(`/api/novels/${novelId}/glossary/entries/${entryId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete");
        setEntries((prev) => prev.filter((e) => e.id !== entryId));
        if (editingId === entryId) setEditingId(null);
        showToast(t("glossary.entryDeleted"), "success");
      } catch {
        showToast(t("glossary.entryDeleteFailed"), "error");
      }
    },
    [novelId, editingId, showToast, t],
  );

  const saveStyleGuide = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/novels/${novelId}/glossary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glossary }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      showToast(t("glossary.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }, [novelId, glossary, showToast, t]);

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
        showToast(data.error ?? t("glossary.generateFailed"), "error");
        return;
      }
      setGlossary(data.glossary ?? "");
      setMeta({
        modelName: data.modelName ?? null,
        episodeCount: data.episodeCount ?? null,
        generatedAt: new Date().toISOString(),
      });
      // Refresh entries table with newly imported entries
      loadEntries();
      const imported = data.entriesImported ?? 0;
      showToast(
        imported > 0
          ? t("glossary.generatedWithEntries", { count: imported })
          : t("glossary.generated"),
        "success",
      );
    } catch {
      showToast(t("glossary.networkError"), "error");
    } finally {
      setGenerating(false);
    }
  }, [novelId, selectedModel, showToast, loadEntries, t]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <section className="surface-card space-y-3 rounded-xl p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-2 text-sm shadow-lg transition-all ${
            toast.type === "error"
              ? "bg-red-500/90 text-white"
              : "bg-accent/90 text-accent-contrast"
          }`}
        >
          {toast.message}
        </div>
      )}

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
              {t("glossary.entries")}
              {!entriesLoading && (
                <span className="ml-2 text-xs font-normal text-muted">
                  ({filteredEntries.length})
                </span>
              )}
            </h3>

            {/* Add entry form — compact: JP, KO, Category, Add */}
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={newTermJa}
                  onChange={(e) => setNewTermJa(e.target.value)}
                  placeholder="JP"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && addEntry()}
                />
                <input
                  type="text"
                  value={newTermKo}
                  onChange={(e) => setNewTermKo(e.target.value)}
                  placeholder="KO"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-border-strong focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && addEntry()}
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as Category)}
                  title="Category"
                  className="rounded-md border border-border bg-background px-2 py-2 text-xs text-foreground focus:border-border-strong focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addEntry}
                  disabled={adding || !newTermJa.trim() || !newTermKo.trim()}
                  className="btn-pill btn-accent whitespace-nowrap px-4 py-2 text-xs"
                >
                  {adding ? "..." : "+"}
                </button>
              </div>
            </div>

            {/* Category filter tabs with counts */}
            <div className="flex flex-wrap gap-1">
              {filterTabs.map((tab) => (
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
                  <span className="ml-1 opacity-60">
                    {categoryCounts[tab.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Entries table — columns: Category | JP | KO | Imp | Actions */}
            {entriesLoading ? (
              <p className="py-4 text-center text-xs text-muted">{t("glossary.loading")}</p>
            ) : filteredEntries.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">
                {t("glossary.noEntries")}
              </p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="w-20 pb-2 pr-2 font-medium">Cat</th>
                      <th className="pb-2 pr-2 font-medium">JP</th>
                      <th className="pb-2 pr-2 font-medium">KO</th>
                      <th className="hidden w-16 pb-2 pr-2 text-center font-medium sm:table-cell">
                        {t("glossary.importance")}
                      </th>
                      <th className="w-20 pb-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedEntries.map((entry) =>
                      editingId === entry.id ? (
                        /* ---- Inline edit row ---- */
                        <tr
                          key={entry.id}
                          className="border-b border-accent/20 bg-accent/5"
                        >
                          <td className="py-2 pr-2">
                            <select
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value as Category)
                              }
                              title="Category"
                              className="w-full rounded border border-border bg-background px-1 py-1 text-xs focus:outline-none"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {categoryLabel(c)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={editTermJa}
                              onChange={(e) => setEditTermJa(e.target.value)}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={editTermKo}
                              onChange={(e) => setEditTermKo(e.target.value)}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none"
                              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            />
                          </td>
                          <td className="hidden py-2 pr-2 text-center sm:table-cell">
                            <select
                              value={editImportance}
                              onChange={(e) =>
                                setEditImportance(Number(e.target.value))
                              }
                              title="Importance"
                              className="w-full rounded border border-border bg-background px-1 py-1 text-xs text-center focus:outline-none"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                disabled={editSaving}
                                className="rounded px-2 py-1 text-xs text-accent hover:bg-accent/10 transition-colors"
                                aria-label="Save"
                              >
                                {editSaving ? "..." : t("glossary.save")}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-strong transition-colors"
                                aria-label="Cancel"
                              >
                                {t("glossary.cancel")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        /* ---- Display row ---- */
                        <tr
                          key={entry.id}
                          className="border-b border-border/50 last:border-0 hover:bg-surface-strong/30 cursor-pointer"
                          onClick={() => startEdit(entry)}
                        >
                          <td className="py-2 pr-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(entry.category)}`}
                            >
                              {CATEGORY_I18N_KEYS[entry.category as Category]
                                ? categoryLabel(entry.category as Category)
                                : entry.category}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-2 pr-2 font-medium text-foreground">
                            {entry.termJa}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-2 text-foreground">
                            {entry.termKo}
                          </td>
                          <td className="hidden py-2 pr-2 text-center text-xs text-muted/60 sm:table-cell">
                            {importanceStars(entry.importance)}
                          </td>
                          <td className="py-2">
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry.id)}
                                className="rounded px-2 py-1 text-xs text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                aria-label="Delete"
                              >
                                &times;
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs text-muted">
                    <span>
                      {currentPage * PAGE_SIZE + 1}&ndash;
                      {Math.min((currentPage + 1) * PAGE_SIZE, filteredEntries.length)}
                      {" of "}
                      {filteredEntries.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="rounded px-2 py-1 hover:bg-surface-strong disabled:opacity-30 transition-colors"
                      >
                        &larr;
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                        disabled={currentPage >= totalPages - 1}
                        className="rounded px-2 py-1 hover:bg-surface-strong disabled:opacity-30 transition-colors"
                      >
                        &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* ============================================================ */}
          {/*  STYLE GUIDE (free-text)                                      */}
          {/* ============================================================ */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              {t("glossary.styleGuide")}
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
              rows={8}
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
                  <div className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-border bg-surface p-2 shadow-lg">
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
