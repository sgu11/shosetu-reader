/**
 * Kakuyomu (https://kakuyomu.jp/) adapter.
 *
 * Work + episode pages embed `__NEXT_DATA__` (parsed via kakuyomu-apollo.ts);
 * the ranking page is a legacy SSR template parsed directly with cheerio.
 *
 * IDs are kakuyomu's internal 19-digit numeric work ids. Episode ids are
 * opaque 19-digit strings that flow through as `sourceEpisodeId` rather
 * than ordinal episode numbers (kakuyomu's URLs reference the opaque id).
 */

import * as cheerio from "cheerio";
import { createHash } from "crypto";
import type {
  EpisodeContent,
  EpisodeRef,
  NovelMetadata,
  RankingPeriod,
  SourceAdapter,
  TocEntry,
} from "../domain/source-adapter";
import { parseWorkPage } from "./kakuyomu-apollo";

const NOVEL_HOST = "https://kakuyomu.jp";
const USER_AGENT = "ShosetuReader/0.1";
const URL_HOST = "kakuyomu.jp";
const WORK_ID_PATTERN = /^[0-9]{15,20}$/;

const SUPPORTED_PERIODS: readonly RankingPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "entire",
];

const RANKING_PATH: Record<RankingPeriod, string | null> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
  entire: "entire",
  quarterly: null,
  hot: null,
};

function buildNovelUrl(id: string) {
  return `${NOVEL_HOST}/works/${id}`;
}

function buildEpisodeUrl(id: string, ep: { sourceEpisodeId: string }) {
  return `${NOVEL_HOST}/works/${id}/episodes/${ep.sourceEpisodeId}`;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`kakuyomu fetch ${url} failed: HTTP ${res.status}`);
  }
  return res.text();
}

export function parseEpisodeBody(html: string): EpisodeContent {
  const $ = cheerio.load(html);
  const title = $(".widget-episodeTitle").first().text().trim();

  const body = $(".widget-episodeBody").first();
  const paragraphs: string[] = [];
  body.find("p").each((_i, el) => {
    paragraphs.push($(el).text());
  });

  const rawHtml = body
    .find("p")
    .map((_i, el) => $.html(el))
    .get()
    .join("\n");

  const normalizedText = paragraphs.join("\n");
  const checksum = createHash("sha256")
    .update(normalizedText)
    .digest("hex")
    .slice(0, 16);

  return {
    title: title || "",
    rawHtml,
    normalizedText,
    checksum,
    prefaceText: null,
    afterwordText: null,
  };
}

export function parseRankingPage(html: string, limit: number): NovelMetadata[] {
  const $ = cheerio.load(html);
  const items: NovelMetadata[] = [];
  const seen = new Set<string>();
  $(".widget-workCard-title a.widget-workCard-titleLabel").each((_i, el) => {
    if (items.length >= limit) return false;
    const href = $(el).attr("href") ?? "";
    const match = href.match(/^\/works\/(\d+)/);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.add(id);
    const title = $(el).text().trim();
    const authorEl = $(el)
      .closest(".widget-workCard-title")
      .find(".widget-workCard-authorLabel")
      .first();
    const authorName = authorEl.text().trim();
    items.push({
      id,
      title,
      authorName,
      summary: "",
      firstPublishedAt: null,
      lastUpdatedAt: null,
      isCompleted: null,
      totalEpisodes: null,
      totalLength: null,
      novelUpdatedAt: null,
      raw: { source: "ranking", href },
    });
  });
  return items;
}

export const kakuyomuAdapter: SourceAdapter = {
  site: "kakuyomu",
  isAdult: false,
  supportedPeriods: SUPPORTED_PERIODS,

  matchUrl(input) {
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    if (!trimmed.toLowerCase().includes(URL_HOST)) return null;
    const m = trimmed.match(/\/works\/(\d+)/);
    return m ? m[1] : null;
  },

  matchBareId(input) {
    const trimmed = input.trim();
    return WORK_ID_PATTERN.test(trimmed) ? trimmed : null;
  },

  buildNovelUrl,

  buildEpisodeUrl(id, ep) {
    return buildEpisodeUrl(id, ep);
  },

  async fetchNovelMetadata(id): Promise<NovelMetadata> {
    const html = await fetchText(buildNovelUrl(id));
    const work = parseWorkPage(html, id);
    return {
      id: work.id,
      title: work.title,
      authorName: work.authorName,
      summary: work.summary,
      firstPublishedAt: work.publishedAt,
      lastUpdatedAt: work.lastEpisodePublishedAt,
      isCompleted: work.isCompleted,
      totalEpisodes: work.publicEpisodeCount,
      totalLength: work.totalCharacterCount,
      novelUpdatedAt: work.lastEpisodePublishedAt,
      raw: work.raw,
    };
  },

  async fetchEpisodeList(id): Promise<TocEntry[]> {
    const html = await fetchText(buildNovelUrl(id));
    const work = parseWorkPage(html, id);
    return work.episodes.map((ep) => ({
      episodeNumber: ep.episodeNumber,
      sourceEpisodeId: ep.id,
      title: ep.title,
      sourceUrl: `${NOVEL_HOST}/works/${id}/episodes/${ep.id}`,
    }));
  },

  async fetchEpisodeContent(id, ep: EpisodeRef) {
    const html = await fetchText(buildEpisodeUrl(id, ep));
    return parseEpisodeBody(html);
  },

  async fetchRanking(period, limit) {
    const slug = RANKING_PATH[period];
    if (!slug) {
      throw new Error(`kakuyomu: unsupported ranking period: ${period}`);
    }
    const url = `${NOVEL_HOST}/rankings/all/${slug}?work_variation=long`;
    const html = await fetchText(url);
    return parseRankingPage(html, Math.min(limit, 50));
  },
};
