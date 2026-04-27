/**
 * Adapter interface for novel sources. Each external site (syosetu, nocturne,
 * kakuyomu, alphapolis) implements this; callers dispatch via the registry
 * rather than depending on site-specific modules.
 */

export type SourceSite = "syosetu" | "nocturne" | "kakuyomu" | "alphapolis";

export type RankingPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly" // syosetu, nocturne
  | "yearly" // kakuyomu
  | "entire" // kakuyomu
  | "hot"; // alphapolis

export interface EpisodeRef {
  /** 1-based ordinal within the novel. */
  episodeNumber: number;
  /**
   * Site-canonical episode identifier. For ordinal sources (syosetu, nocturne,
   * alphapolis) this is `String(episodeNumber)`. For kakuyomu it is the opaque
   * episode id from the work's table of contents.
   */
  sourceEpisodeId: string;
}

export interface TocEntry {
  episodeNumber: number;
  sourceEpisodeId: string;
  title: string;
  sourceUrl: string;
}

export interface NovelMetadata {
  /** Site-canonical id: ncode for syosetu/nocturne, work id for kakuyomu, "{author}/{novel}" for alphapolis. */
  id: string;
  title: string;
  authorName: string;
  summary: string;
  firstPublishedAt: string | null;
  lastUpdatedAt: string | null;
  /** null = unknown; sources that do not surface completion state may return null. */
  isCompleted: boolean | null;
  totalEpisodes: number | null;
  totalLength: number | null;
  novelUpdatedAt: string | null;
  /** Site-specific raw payload retained for diagnostics + sourceMetadataJson. */
  raw: unknown;
}

export interface EpisodeContent {
  title: string;
  rawHtml: string;
  normalizedText: string;
  checksum: string;
  prefaceText: string | null;
  afterwordText: string | null;
}

export interface SourceAdapter {
  readonly site: SourceSite;
  readonly isAdult: boolean;
  readonly supportedPeriods: readonly RankingPeriod[];

  /** Recognize a URL belonging to this source; return canonical id or null. */
  matchUrl(input: string): string | null;
  /** Recognize a bare id paste (e.g. ncode); return canonical id or null. */
  matchBareId(input: string): string | null;

  buildNovelUrl(id: string): string;
  buildEpisodeUrl(id: string, ep: EpisodeRef): string;

  fetchNovelMetadata(id: string): Promise<NovelMetadata>;
  fetchEpisodeList(id: string): Promise<TocEntry[]>;
  fetchEpisodeContent(id: string, ep: EpisodeRef): Promise<EpisodeContent>;
  fetchRanking(period: RankingPeriod, limit: number): Promise<NovelMetadata[]>;
}
