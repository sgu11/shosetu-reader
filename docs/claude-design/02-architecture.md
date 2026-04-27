# Architecture

## SourceAdapter interface

`src/modules/source/domain/source-adapter.ts`. Every site implements this:

```ts
type SourceSite = "syosetu" | "nocturne" | "kakuyomu" | "alphapolis";

type RankingPeriod =
  | "daily" | "weekly" | "monthly"
  | "quarterly"          // syosetu, nocturne
  | "yearly" | "entire"  // kakuyomu
  | "hot";               // alphapolis

interface EpisodeRef {
  episodeNumber: number;        // 1-based ordinal within the novel
  sourceEpisodeId: string;      // String(episodeNumber) for ordinal sites,
                                // opaque id for kakuyomu
}

interface TocEntry {
  episodeNumber: number;
  sourceEpisodeId: string;
  title: string;
  sourceUrl: string;
}

interface NovelMetadata {
  id: string;                   // canonical site-specific id
  title: string;
  authorName: string;
  summary: string;
  firstPublishedAt: string | null;
  lastUpdatedAt: string | null;
  isCompleted: boolean | null;  // null = unknown
  totalEpisodes: number | null;
  totalLength: number | null;
  novelUpdatedAt: string | null;
  raw: unknown;                 // site-specific payload for diagnostics
}

interface EpisodeContent {
  title: string;
  rawHtml: string;
  normalizedText: string;
  checksum: string;
  prefaceText: string | null;   // syosetu-family only
  afterwordText: string | null; // syosetu-family only
}

interface SourceAdapter {
  site: SourceSite;
  isAdult: boolean;             // gates default visibility
  supportedPeriods: readonly RankingPeriod[];

  matchUrl(input: string): string | null;
  matchBareId(input: string): string | null;
  buildNovelUrl(id: string): string;
  buildEpisodeUrl(id: string, ep: EpisodeRef): string;

  fetchNovelMetadata(id: string): Promise<NovelMetadata>;
  fetchEpisodeList(id: string): Promise<TocEntry[]>;
  fetchEpisodeContent(id: string, ep: EpisodeRef): Promise<EpisodeContent>;
  fetchRanking(period: RankingPeriod, limit: number): Promise<NovelMetadata[]>;
}
```

Two design notes worth flagging:

- **`isCompleted: boolean | null`** — kakuyomu/alphapolis don't always surface
  serialization status. `null` is "unknown"; never coerce to `false` at the
  adapter layer. `RankingItem.isCompleted` widens accordingly downstream.
- **`TocEntry.sourceEpisodeId` is required** — `ingest-episodes.ts` used to
  coerce `String(entry.episodeNumber)` for syosetu, which silently broke for
  kakuyomu (opaque ids ≠ ordinals). Adapters now own the field.

## Registry + rate-limit decorator

`src/modules/source/infra/registry.ts`.

```ts
export function getAdapter(site: SourceSite): SourceAdapter
export function listEnabledSites(): SourceSite[]
export function parseInput(input: string): { site: SourceSite; id: string } | null
```

### `HostBucket`

Per-host token bucket. One acquire per outbound fetch:

```ts
class HostBucket {
  constructor(intervalMs: number)
  acquire(): Promise<void>  // resolves when the next request can fire
}
```

Three buckets in production:
- `SYOSETU_FAMILY_BUCKET` (1000ms) — shared by syosetu + nocturne (both hit `api.syosetu.com`).
- `KAKUYOMU_BUCKET` (2000ms) — kakuyomu HTML scrape is heavier than a JSON API.
- `ALPHAPOLIS_BUCKET` (1500ms).

### `RateLimitedAdapter` decorator

```ts
const adapters = {
  syosetu:    withRateLimit(syosetuAdapter, SYOSETU_FAMILY_BUCKET),
  nocturne:   withRateLimit(nocturneAdapter, SYOSETU_FAMILY_BUCKET),
  kakuyomu:   withRateLimit(kakuyomuAdapter, KAKUYOMU_BUCKET),
  alphapolis: withRateLimit(alphapolisAdapter, ALPHAPOLIS_BUCKET),
};
```

The decorator wraps the four `fetch*` methods so callers never think about
delays. This was the key reviewer fix: previously `FETCH_DELAY_MS` was
hard-coded inside `ingest-episodes.ts`, which only throttled the batch loop
— concurrent ranking + register requests from API routes blew the budget.

### `parseInput`

Resolves a register form input into `{site, id}`. URL match runs across every
enabled adapter first (deterministic), then falls back to bare-id matchers in
priority order. Bare ncode → syosetu (nocturne requires URL form to
disambiguate). Bare `^\d+/\d+$` → alphapolis. Bare 19-digit → kakuyomu.

## Application layer

Callers never import site-specific modules. They go through the registry:

```ts
// register-novel.ts
const adapter = getAdapter(site);
const metadata = await adapter.fetchNovelMetadata(id);

// ingest-episodes.ts
const adapter = getAdapter(novel.sourceSite as SourceSite);
const tocEntries = await adapter.fetchEpisodeList(novel.sourceId);

// get-ranking-sections.ts
for (const site of sites) {
  await getAdapter(site).fetchRanking(period, limit);
}
```

`getRankingSections` is the multi-source aggregator: `Promise.allSettled` with
a per-section timeout (8s; some upstream HTML pages run slow during heavy
hours), per-section status (`ok | timeout | error`), and per-section adult
filtering before the result is mapped into `RankingSectionItem`.

## Adult-content gate

`src/modules/catalog/application/adult-filter.ts`:

```ts
type AdultFilterContext = { adultContentEnabled: boolean };

filterAdultContent<T extends { sourceSite: SourceSite }>(
  items: T[],
  ctx: AdultFilterContext | null,   // null = anonymous = SFW only
): T[]
```

`resolveAdultContext(userId)` reads the active profile's
`reader_preferences.adult_content_enabled` from the DB. The default value is
`true` (column default) — but anonymous callers (no active profile cookie)
get `null` and SFW-only.

Always at the **application layer**, never registry or per-route. Reviewer
rationale: registry-level gating means the adapter doesn't run, which kills
the "this novel exists but is hidden" UX hint; per-route gating duplicates
the rule.
