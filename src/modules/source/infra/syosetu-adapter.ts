/**
 * Syosetu (https://ncode.syosetu.com/) adapter. Wraps the existing JSON-API
 * client and HTML scraper behind the SourceAdapter interface so callers can
 * dispatch through the registry instead of importing site-specific modules.
 */

import type {
  EpisodeContent,
  EpisodeRef,
  NovelMetadata,
  RankingPeriod,
  SourceAdapter,
  TocEntry,
} from "../domain/source-adapter";
import { isValidNcode, parseNcode, buildNovelUrl, buildEpisodeUrl } from "../domain/ncode";
import {
  fetchNovelMetadata as syosetuFetchNovelMetadata,
  fetchRanking as syosetuFetchRanking,
  type RankingPeriod as SyosetuPeriod,
  type SyosetuNovelMetadata,
} from "./syosetu-api";
import {
  fetchEpisodeList as syosetuFetchEpisodeList,
  fetchEpisodeContent as syosetuFetchEpisodeContent,
} from "./episode-scraper";

const SUPPORTED_PERIODS: readonly RankingPeriod[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
];

function adaptMetadata(meta: SyosetuNovelMetadata): NovelMetadata {
  return {
    id: meta.ncode,
    title: meta.title,
    authorName: meta.authorName,
    summary: meta.summary,
    firstPublishedAt: meta.firstPublishedAt,
    lastUpdatedAt: meta.lastUpdatedAt,
    isCompleted: meta.isCompleted,
    totalEpisodes: meta.totalEpisodes,
    totalLength: meta.totalLength,
    novelUpdatedAt: meta.novelUpdatedAt,
    raw: meta.raw,
  };
}

export const syosetuAdapter: SourceAdapter = {
  site: "syosetu",
  isAdult: false,
  supportedPeriods: SUPPORTED_PERIODS,

  matchUrl(input) {
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return parseNcode(trimmed);
  },

  matchBareId(input) {
    const trimmed = input.trim().toLowerCase();
    return isValidNcode(trimmed) ? trimmed : null;
  },

  buildNovelUrl(id) {
    return buildNovelUrl(id);
  },

  buildEpisodeUrl(id, ep) {
    return buildEpisodeUrl(id, ep.episodeNumber);
  },

  async fetchNovelMetadata(id) {
    return adaptMetadata(await syosetuFetchNovelMetadata(id));
  },

  async fetchEpisodeList(id): Promise<TocEntry[]> {
    const entries = await syosetuFetchEpisodeList(id);
    return entries.map((e) => ({
      episodeNumber: e.episodeNumber,
      sourceEpisodeId: String(e.episodeNumber),
      title: e.title,
      sourceUrl: e.sourceUrl,
    }));
  },

  async fetchEpisodeContent(id, ep: EpisodeRef): Promise<EpisodeContent> {
    return syosetuFetchEpisodeContent(id, ep.episodeNumber);
  },

  async fetchRanking(period, limit) {
    const items = await syosetuFetchRanking(period as SyosetuPeriod, limit);
    return items.map(adaptMetadata);
  },
};
