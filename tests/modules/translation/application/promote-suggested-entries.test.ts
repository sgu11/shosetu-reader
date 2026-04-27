import { describe, expect, it } from "vitest";
import {
  PROMOTE_THRESHOLD,
  REINFORCE_DELTA,
  WEAKEN_DELTA,
  planPromotions,
  type PromoteCandidate,
} from "@/modules/translation/application/promote-suggested-entries";

const ja = "魔法学院です。リカは主人公の妹。";
const ko = "마법학원이다. 리카는 주인공의 여동생.";

const make = (
  id: string,
  termJa: string,
  termKo: string,
  confidence: number | null,
): PromoteCandidate => ({ id, termJa, termKo, confidence });

describe("planPromotions", () => {
  it("reinforces an entry that appears in both texts", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "魔法学院", "마법학원", 0.4)],
      ja,
      ko,
      5,
    );
    expect(counts).toMatchObject({ reinforced: 1, promoted: 0, weakened: 0, unchanged: 0 });
    expect(updates[0]).toMatchObject({
      kind: "reinforced",
      id: "e1",
      status: "suggested",
      sourceEpisodeNumber: null,
    });
    expect(updates[0].confidence).toBeCloseTo(0.4 + REINFORCE_DELTA);
  });

  it("promotes when reinforced confidence reaches threshold", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "魔法学院", "마법학원", PROMOTE_THRESHOLD - REINFORCE_DELTA)],
      ja,
      ko,
      7,
    );
    expect(counts.promoted).toBe(1);
    expect(updates[0]).toMatchObject({
      kind: "promoted",
      status: "confirmed",
      sourceEpisodeNumber: 7,
    });
  });

  it("weakens an entry whose JA appears but KO rendering differs", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "主人公", "주연", 0.5)],
      ja,
      ko,
      3,
    );
    expect(counts).toMatchObject({ weakened: 1, reinforced: 0 });
    expect(updates[0]).toMatchObject({ kind: "weakened", id: "e1" });
    expect(updates[0].confidence).toBeCloseTo(0.5 - WEAKEN_DELTA);
  });

  it("clamps weakened confidence at 0", () => {
    const { updates } = planPromotions(
      [make("e1", "主人公", "주연", 0.05)],
      ja,
      ko,
      3,
    );
    expect(updates[0].confidence).toBe(0);
  });

  it("clamps reinforced confidence at 1", () => {
    const { updates } = planPromotions(
      [make("e1", "魔法学院", "마법학원", 0.95)],
      ja,
      ko,
      1,
    );
    expect(updates[0].confidence).toBe(1);
  });

  it("leaves entries unchanged when JA absent from source", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "完全に存在しない", "없는것", 0.4)],
      ja,
      ko,
      3,
    );
    expect(counts).toMatchObject({ unchanged: 1 });
    expect(updates).toHaveLength(0);
  });

  it("normalizes whitespace + case when matching KO", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "魔法学院", "마법 학원", 0.4)],
      ja,
      "마법학원이다.",
      3,
    );
    expect(counts.reinforced).toBe(1);
    expect(updates[0].kind).toBe("reinforced");
  });

  it("handles empty corpus gracefully", () => {
    const { updates, counts } = planPromotions(
      [make("e1", "魔法学院", "마법학원", 0.4)],
      "",
      "",
      3,
    );
    expect(counts.unchanged).toBe(1);
    expect(updates).toHaveLength(0);
  });

  it("treats missing confidence as 0", () => {
    const { updates } = planPromotions(
      [make("e1", "魔法学院", "마법학원", null)],
      ja,
      ko,
      3,
    );
    expect(updates[0].confidence).toBeCloseTo(REINFORCE_DELTA);
  });
});
