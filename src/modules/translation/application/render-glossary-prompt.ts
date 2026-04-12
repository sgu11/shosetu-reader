export interface GlossaryPromptEntry {
  termJa: string;
  termKo: string;
  reading: string | null;
  category: string;
  notes: string | null;
}

/**
 * Render confirmed glossary entries as a compact markdown table grouped by category,
 * followed by the style guide text. Ordering is deterministic for cacheability.
 */
export function renderGlossaryPrompt(
  entries: GlossaryPromptEntry[],
  styleGuide: string,
): string {
  const parts: string[] = [];

  if (entries.length > 0) {
    // Group by category
    const grouped = new Map<string, GlossaryPromptEntry[]>();
    for (const entry of entries) {
      const group = grouped.get(entry.category) ?? [];
      group.push(entry);
      grouped.set(entry.category, group);
    }

    // Render each category as a markdown table
    // Sort categories deterministically
    const categoryOrder = ["character", "place", "term", "skill", "honorific"];
    const sortedCategories = [...grouped.keys()].sort(
      (a, b) => (categoryOrder.indexOf(a) ?? 99) - (categoryOrder.indexOf(b) ?? 99),
    );

    parts.push("Glossary:");
    for (const category of sortedCategories) {
      const group = grouped.get(category)!;
      // Sort entries by termJa within category
      group.sort((a, b) => a.termJa.localeCompare(b.termJa));

      const label = category.charAt(0).toUpperCase() + category.slice(1) + "s";
      parts.push(`\n### ${label}`);
      parts.push("| Japanese | Korean | Notes |");
      parts.push("|----------|--------|-------|");
      for (const entry of group) {
        const reading = entry.reading ? ` (${entry.reading})` : "";
        const notes = entry.notes ?? "";
        parts.push(`| ${entry.termJa}${reading} | ${entry.termKo} | ${notes} |`);
      }
    }
  }

  if (styleGuide.trim()) {
    if (parts.length > 0) parts.push("");
    parts.push("Style guide & translation reference:");
    parts.push(styleGuide.trim());
  }

  return parts.join("\n");
}
