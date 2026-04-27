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

## Registry

`src/modules/source/infra/registry.ts`.

```ts
export function getAdapter(site: SourceSite): SourceAdapter
export function listEnabledSites(): SourceSite[]
export function parseInput(input: string): { site: SourceSite; id: string } | null
```

The registry is intentionally thin: a static `Partial<Record<SourceSite, SourceAdapter>>`
plus the URL/id parser. Adapters are returned bare — there is no
process-wide rate-limit decorator. Throttling lives at each call site.

### Why no global bucket

An earlier iteration wrapped each adapter in a `RateLimitedAdapter` decorator
backed by a per-host promise-chain `HostBucket`. That shape serialized
every outbound fetch through a single growing chain per host. While the
worker was running `fetchPendingEpisodes` against a novel with N pending
episodes, the chain held N pending acquires; any concurrent /ranking,
/reader, or /api/* request that touched the same upstream queued behind
the entire batch and timed out at 20s. Aries logs filled with
`TimeoutError` and the site looked unresponsive to users.

The fix: the worker's batch loops keep their own inline `setTimeout`
politeness sleeps (1 req/s), and API routes go to the upstream directly.
Worker throttling is now a single-lane concern, not a global coupling.

### Throttling that survives

| Caller | Throttle |
|---|---|
| Worker `fetchPendingEpisodes`, `reingestNovelByChecksum` | `setTimeout(FETCH_DELAY_MS=1000)` between iterations inside the loop |
| Worker `refreshSubscribedNovelMetadata` | `setTimeout(1000)` between iterations (already inline) |
| `/api/novels/register` | One fetch per call; rate-limited on the **route** by `rateLimit(req, RATE_LIMIT, "register")` (5/min/IP) |
| `/api/ranking` | One fetch per call; route-level rate limit (20/min/IP) |
| `/api/translations/*` | Reader-page fetch; throttled by browser request batching + the existing rate limiter |

The site-level upstream-politeness budget is therefore:
- Worker: ≤1 req/s per active novel ingest, no upper bound on episode count
- API: bounded by per-IP rate limits already in `rateLimit()` (Redis-backed)

If a future need calls for cross-lane throttling (e.g. shared upstream
quota), see `08-known-gotchas.md` for the design notes on what NOT to do
(promise-chain bucket) and what would work (leaky bucket with backpressure,
two separate buckets per host, or reusing the Redis rate limiter).

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
