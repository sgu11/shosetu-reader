import { describe, it, expect } from "vitest";
import { stratifiedEpisodeSample } from "@/modules/translation/application/sample-strategy";

type Row = { episodeNumber: number };

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ episodeNumber: i + 1 }));

describe("stratifiedEpisodeSample", () => {
  it("returns empty for empty input", () => {
    expect(stratifiedEpisodeSample([])).toEqual([]);
  });

  it("returns all rows when below max", () => {
    const input = rows(5);
    const out = stratifiedEpisodeSample(input, 10);
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.episodeNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("includes first three episodes when over max", () => {
    const out = stratifiedEpisodeSample(rows(50), 10);
    const nums = out.map((r) => r.episodeNumber);
    expect(nums).toContain(1);
    expect(nums).toContain(2);
    expect(nums).toContain(3);
  });

  it("includes latest three episodes when over max", () => {
    const out = stratifiedEpisodeSample(rows(50), 10);
    const nums = out.map((r) => r.episodeNumber);
    expect(nums).toContain(48);
    expect(nums).toContain(49);
    expect(nums).toContain(50);
  });

  it("includes mid-arc samples at 30% and 60%", () => {
    const out = stratifiedEpisodeSample(rows(100), 10);
    const nums = out.map((r) => r.episodeNumber);
    // indexes 30 (ep 31) and 60 (ep 61)
    expect(nums).toContain(31);
    expect(nums).toContain(61);
  });

  it("returns sorted ascending by episodeNumber", () => {
    const out = stratifiedEpisodeSample(rows(50), 10);
    const nums = out.map((r) => r.episodeNumber);
    const sorted = [...nums].sort((a, b) => a - b);
    expect(nums).toEqual(sorted);
  });

  it("caps output at max", () => {
    const out = stratifiedEpisodeSample(rows(200), 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });

  it("deduplicates overlapping picks", () => {
    // With n=4 and max=10, first-3 overlaps latest-3 → all 4 rows returned once
    const out = stratifiedEpisodeSample(rows(4), 10);
    const nums = out.map((r) => r.episodeNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });
});
