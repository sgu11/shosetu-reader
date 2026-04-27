import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { kakuyomuAdapter, parseEpisodeBody, parseRankingPage } from "@/modules/source/infra/kakuyomu-adapter";
import { parseWorkPage } from "@/modules/source/infra/kakuyomu-apollo";

const FIXTURE_DIR = resolve(__dirname, "fixtures/kakuyomu");
const workHtml = readFileSync(resolve(FIXTURE_DIR, "work.html"), "utf-8");
const episodeHtml = readFileSync(resolve(FIXTURE_DIR, "episode.html"), "utf-8");
const rankingHtml = readFileSync(resolve(FIXTURE_DIR, "ranking-daily.html"), "utf-8");

const TARGET_WORK_ID = "822139845727270228";

describe("kakuyomuAdapter identity", () => {
  it("declares the right site identity", () => {
    expect(kakuyomuAdapter.site).toBe("kakuyomu");
    expect(kakuyomuAdapter.isAdult).toBe(false);
    expect(kakuyomuAdapter.supportedPeriods).toEqual([
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "entire",
    ]);
  });

  it("matches a kakuyomu work URL", () => {
    expect(
      kakuyomuAdapter.matchUrl("https://kakuyomu.jp/works/1177354054887670557"),
    ).toBe("1177354054887670557");
    expect(
      kakuyomuAdapter.matchUrl("https://kakuyomu.jp/works/822139845727270228/episodes/123"),
    ).toBe("822139845727270228");
    expect(kakuyomuAdapter.matchUrl("https://ncode.syosetu.com/n1234ab/")).toBeNull();
  });

  it("matches bare 19-digit numeric ids", () => {
    expect(kakuyomuAdapter.matchBareId("1177354054887670557")).toBe(
      "1177354054887670557",
    );
    expect(kakuyomuAdapter.matchBareId("n1234ab")).toBeNull();
    expect(kakuyomuAdapter.matchBareId("12345/67890")).toBeNull();
  });

  it("builds expected URLs", () => {
    expect(kakuyomuAdapter.buildNovelUrl(TARGET_WORK_ID)).toBe(
      `https://kakuyomu.jp/works/${TARGET_WORK_ID}`,
    );
    expect(
      kakuyomuAdapter.buildEpisodeUrl(TARGET_WORK_ID, {
        episodeNumber: 1,
        sourceEpisodeId: "822139845727288752",
      }),
    ).toBe(
      `https://kakuyomu.jp/works/${TARGET_WORK_ID}/episodes/822139845727288752`,
    );
  });
});

describe("parseWorkPage", () => {
  it("extracts metadata from the embedded Apollo state", () => {
    const work = parseWorkPage(workHtml, TARGET_WORK_ID);
    expect(work.id).toBe(TARGET_WORK_ID);
    expect(work.title.length).toBeGreaterThan(0);
    expect(work.authorName.length).toBeGreaterThan(0);
    expect(work.summary.length).toBeGreaterThan(0);
    expect(work.episodes.length).toBeGreaterThan(0);
    expect(work.episodes[0].id).toMatch(/^\d+$/);
    expect(work.episodes[0].episodeNumber).toBe(1);
    expect(typeof work.isAdult).toBe("boolean");
  });

  it("flags adult works via per-work toggles", () => {
    const work = parseWorkPage(workHtml, TARGET_WORK_ID);
    // The fixture work has isCruel/isViolent/isSexual flags set
    expect(work.isAdult).toBe(true);
  });

  it("renders TOC entries with sequential ordinals", () => {
    const work = parseWorkPage(workHtml, TARGET_WORK_ID);
    const ordinals = work.episodes.map((e) => e.episodeNumber);
    const expected = ordinals.map((_, i) => i + 1);
    expect(ordinals).toEqual(expected);
  });
});

describe("parseEpisodeBody", () => {
  it("extracts title and paragraphs", () => {
    const content = parseEpisodeBody(episodeHtml);
    expect(content.title.length).toBeGreaterThan(0);
    expect(content.normalizedText.length).toBeGreaterThan(0);
    expect(content.checksum).toMatch(/^[a-f0-9]{16}$/);
    expect(content.prefaceText).toBeNull();
    expect(content.afterwordText).toBeNull();
  });
});

describe("parseRankingPage", () => {
  it("returns up to N work entries from the ranking page", () => {
    const items = parseRankingPage(rankingHtml, 20);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(20);
    for (const item of items) {
      expect(item.id).toMatch(/^\d+$/);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });

  it("does not duplicate work ids across the ranking", () => {
    const items = parseRankingPage(rankingHtml, 50);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
