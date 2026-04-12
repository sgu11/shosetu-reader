const MAX_PROMPT_ENTRIES = 50;

export interface GlossaryPromptEntry {
  termJa: string;
  termKo: string;
  reading: string | null;
  category: string;
  notes: string | null;
  importance: number;
}

/** Escape pipe characters to prevent markdown table breakage. */
function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/**
 * Render confirmed glossary entries as a compact markdown table grouped by category,
 * followed by the style guide text. Ordering is deterministic for cacheability.
 * Caps at 50 entries max, sorted by importance DESC then termJa ASC.
 */
export function renderGlossaryPrompt(
  entries: GlossaryPromptEntry[],
  styleGuide: string,
): string {
  const parts: string[] = [];

  if (entries.length > 0) {
    // Cap at MAX_PROMPT_ENTRIES: sort by importance DESC, then termJa ASC
    let omittedCount = 0;
    let selected = entries;
    if (entries.length > MAX_PROMPT_ENTRIES) {
      const sorted = [...entries].sort((a, b) => {
        if (b.importance !== a.importance) return b.importance - a.importance;
        return a.termJa.localeCompare(b.termJa);
      });
      selected = sorted.slice(0, MAX_PROMPT_ENTRIES);
      omittedCount = entries.length - MAX_PROMPT_ENTRIES;
    }

    // Group by category
    const grouped = new Map<string, GlossaryPromptEntry[]>();
    for (const entry of selected) {
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
        const reading = entry.reading ? ` (${escapePipe(entry.reading)})` : "";
        const notes = entry.notes ? escapePipe(entry.notes) : "";
        parts.push(`| ${entry.termJa}${reading} | ${entry.termKo} | ${notes} |`);
      }
    }

    if (omittedCount > 0) {
      parts.push(`\n(+${omittedCount} entries omitted)`);
    }
  }

  if (styleGuide.trim()) {
    if (parts.length > 0) parts.push("");
    parts.push("Style guide & translation reference:");
    parts.push(styleGuide.trim());
  }

  return parts.join("\n");
}
