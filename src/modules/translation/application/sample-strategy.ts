/**
 * Pick a stratified subset of translated episodes for glossary generation.
 * Strategy:
 *   - first 3 episodes (voice, core cast, honorifics)
 *   - 2 mid-arc episodes (30% and 60% markers)
 *   - latest 3 episodes (current terms)
 * Deduped and clamped to `max`. Returns rows in ascending episode order.
 */
export function stratifiedEpisodeSample<T extends { episodeNumber: number }>(
  rows: T[],
  max = 10,
): T[] {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.episodeNumber - b.episodeNumber);
  if (sorted.length <= max) return sorted;

  const pickIndexes = new Set<number>();
  const n = sorted.length;

  // First three
  for (let i = 0; i < Math.min(3, n); i += 1) pickIndexes.add(i);
  // Mid markers
  pickIndexes.add(Math.floor(n * 0.3));
  pickIndexes.add(Math.floor(n * 0.6));
  // Latest three
  for (let i = Math.max(0, n - 3); i < n; i += 1) pickIndexes.add(i);

  let selected = [...pickIndexes].sort((a, b) => a - b).map((i) => sorted[i]);

  // Trim to max if we over-selected
  if (selected.length > max) selected = selected.slice(0, max);

  // Fill remaining slots with evenly-spaced picks not already selected
  if (selected.length < max) {
    const taken = new Set(pickIndexes);
    const stride = n / (max - selected.length + 1);
    for (let i = 1; selected.length < max && i <= max; i += 1) {
      const idx = Math.min(n - 1, Math.floor(stride * i));
      if (!taken.has(idx)) {
        taken.add(idx);
        selected.push(sorted[idx]);
      }
    }
    selected.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  return selected;
}
