import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const fixturesDir = path.resolve(process.cwd(), "demo/seed/fixtures");

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8")) as T;
}

describe("demo fixtures", () => {
  it("novel has ncode, title_ja, title_ko", () => {
    const novel = readJson<Record<string, unknown>>("novel.json");
    expect(novel).toMatchObject({
      ncode: expect.any(String),
      title_ja: expect.any(String),
      title_ko: expect.any(String),
    });
  });

  it("has 5 JP episodes with id + title + body", () => {
    const eps = readJson<Array<{ id: string; title_ja: string; body_ja: string }>>(
      "episodes.ja.json",
    );
    expect(eps).toHaveLength(5);
    for (const ep of eps) {
      expect(ep.id).toMatch(/^demo-ep-\d+$/);
      expect(ep.title_ja.length).toBeGreaterThan(0);
      expect(ep.body_ja.length).toBeGreaterThan(0);
    }
  });

  it("has 4 KO episode translations (episode 5 left pending)", () => {
    const eps = readJson<Array<{ id: string; body_ko: string }>>("episodes.ko.json");
    expect(eps).toHaveLength(4);
    expect(eps.map((e) => e.id)).toEqual([
      "demo-ep-1",
      "demo-ep-2",
      "demo-ep-3",
      "demo-ep-4",
    ]);
  });

  it("has between 8 and 10 glossary entries", () => {
    const entries = readJson<unknown[]>("glossary.json");
    expect(entries.length).toBeGreaterThanOrEqual(8);
    expect(entries.length).toBeLessThanOrEqual(10);
  });

  it("ranking has daily/weekly/monthly/quarterly keys", () => {
    const ranking = readJson<Record<string, unknown[]>>("ranking.json");
    for (const key of ["daily", "weekly", "monthly", "quarterly"]) {
      expect(Array.isArray(ranking[key])).toBe(true);
    }
  });
});
