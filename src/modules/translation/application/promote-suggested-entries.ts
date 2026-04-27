import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { novelGlossaries, novelGlossaryEntries } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export const REINFORCE_DELTA = 0.2;
export const WEAKEN_DELTA = 0.1;
export const PROMOTE_THRESHOLD = 0.8;
export const MIN_CONFIDENCE = 0.0;

export interface PromoteResult {
  reinforced: number;
  promoted: number;
  weakened: number;
  unchanged: number;
}

export interface PromoteCandidate {
  id: string;
  termJa: string;
  termKo: string;
  confidence: number | null;
}

export type PromoteUpdate =
  | {
      kind: "promoted" | "reinforced";
      id: string;
      confidence: number;
      status: "confirmed" | "suggested";
      sourceEpisodeNumber: number | null;
    }
  | {
      kind: "weakened";
      id: string;
      confidence: number;
    };

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/**
 * Pure planner — no DB. Walks each suggested entry and decides what
 * the row's next confidence/status should look like given the corpus
 * pair. Returns the diff so a wrapper can apply it (and so unit tests
 * can verify the policy without touching Postgres).
 */
export function planPromotions(
  entries: PromoteCandidate[],
  sourceText: string,
  translatedText: string,
  episodeNumber: number,
): { updates: PromoteUpdate[]; counts: PromoteResult } {
  const counts: PromoteResult = {
    reinforced: 0,
    promoted: 0,
    weakened: 0,
    unchanged: 0,
  };

  if (!sourceText || !translatedText) {
    counts.unchanged = entries.length;
    return { updates: [], counts };
  }

  const sourceBlob = sourceText;
  const translatedBlob = normalize(translatedText);
  const updates: PromoteUpdate[] = [];

  for (const entry of entries) {
    const ja = entry.termJa.trim();
    const ko = normalize(entry.termKo);
    if (!ja || !ko) {
      counts.unchanged += 1;
      continue;
    }

    if (!sourceBlob.includes(ja)) {
      counts.unchanged += 1;
      continue;
    }

    const current = entry.confidence ?? 0;
    if (translatedBlob.includes(ko)) {
      const next = Math.min(1, current + REINFORCE_DELTA);
      const promote = next >= PROMOTE_THRESHOLD;
      updates.push({
        kind: promote ? "promoted" : "reinforced",
        id: entry.id,
        confidence: next,
        status: promote ? "confirmed" : "suggested",
        sourceEpisodeNumber: promote ? episodeNumber : null,
      });
      if (promote) counts.promoted += 1;
      else counts.reinforced += 1;
    } else {
      const next = Math.max(MIN_CONFIDENCE, current - WEAKEN_DELTA);
      updates.push({ kind: "weakened", id: entry.id, confidence: next });
      counts.weakened += 1;
    }
  }

  return { updates, counts };
}

/**
 * Walk every `suggested` entry of the novel and validate it against the
 * given (JA source, KO translation) pair.
 *
 * - Both terms appear → confidence += REINFORCE_DELTA. If the new value
 *   meets PROMOTE_THRESHOLD, the entry flips to `confirmed`.
 * - JA appears but KO does not → translator picked a different rendering
 *   for this term; confidence -= WEAKEN_DELTA so the entry decays out
 *   over time and the user can spot the conflict in the editor.
 * - JA absent → term doesn't apply to this episode; no change.
 *
 * This is the second half of the cold-start strategy: the bootstrap pass
 * inserts low-confidence entries from JA-only morph mining; this pass
 * grounds them once real translations exist.
 */
export async function promoteSuggestedEntries(
  novelId: string,
  sourceText: string,
  translatedText: string,
  episodeNumber: number,
): Promise<PromoteResult> {
  const db = getDb();

  const suggested = await db
    .select({
      id: novelGlossaryEntries.id,
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      confidence: novelGlossaryEntries.confidence,
    })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novelId),
        eq(novelGlossaryEntries.status, "suggested"),
      ),
    );

  if (suggested.length === 0) {
    return { reinforced: 0, promoted: 0, weakened: 0, unchanged: 0 };
  }

  const { updates, counts } = planPromotions(
    suggested,
    sourceText,
    translatedText,
    episodeNumber,
  );

  for (const update of updates) {
    if (update.kind === "weakened") {
      await db
        .update(novelGlossaryEntries)
        .set({ confidence: update.confidence, updatedAt: new Date() })
        .where(eq(novelGlossaryEntries.id, update.id));
    } else {
      await db
        .update(novelGlossaryEntries)
        .set({
          confidence: update.confidence,
          status: update.status,
          sourceEpisodeNumber: update.sourceEpisodeNumber,
          updatedAt: new Date(),
        })
        .where(eq(novelGlossaryEntries.id, update.id));
    }
  }

  if (counts.promoted > 0) {
    await db
      .insert(novelGlossaries)
      .values({ novelId, glossary: "", glossaryVersion: 2 })
      .onConflictDoUpdate({
        target: novelGlossaries.novelId,
        set: {
          glossaryVersion: sql`${novelGlossaries.glossaryVersion} + 1`,
          updatedAt: new Date(),
        },
      });
    logger.info("Promoted suggested glossary entries", {
      novelId,
      episodeNumber,
      ...counts,
    });
  }

  return counts;
}
