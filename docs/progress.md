# Progress

Last updated: 2026-04-28

## Current Snapshot

- Product status: V1–V4 implemented; V5 substantially shipped (multi-source
  adapters, EPUB export, quality dashboards, cold-start glossary, big-novel
  safeguards, editorial × cozy paper UI). Remaining V5 work: PWA/offline
  (V5.7), favorite models (V5.9). SSE foundation landed for episode
  translation events.
- Repo shape: `51` API route files, `50` shared components, `10` domain
  modules, `27` SQL migrations, and `29` Vitest files.
- Multi-source live: Syosetu, Nocturne (R-18), Kakuyomu, AlphaPolis behind
  one `SourceAdapter` registry with adult gate, per-section timeout, and
  scheduled live-fetch canary.

## Phase Status

| Phase | Scope | Status |
|-------|-------|--------|
| V1 | Foundation, registration, ingestion, reader baseline, library | Done |
| V2 | Profiles, durable jobs, live updates, translation inventory, admin APIs | Done |
| V3 | Structured glossary, session context chaining, chunking, quality validation | Done |
| V4 | Hardening, performance, cost control, operational visibility | Done |
| V5 | New surfaces, multi-source, export, comparison, glossary cold-start | Mostly shipped |

## What Exists Today

### Pages

- Home, Library, Ranking (multi-source grouped + scope tabs), Register
  (any-site URL detection), Novel detail, Reader (KO/JA toggle, glossary
  drawer, compare mode), Settings (theme, reader, translation, adult
  toggle), Profiles, Sign-in, Stats.

### Sources (V5)

| Site | Code | Adult | Periods | Transport |
|---|---|---|---|---|
| Syosetu | `syosetu` | no | daily / weekly / monthly / quarterly | JSON API |
| Nocturne | `nocturne` | yes | daily / weekly / monthly / quarterly | JSON API + `over18` cookie |
| Kakuyomu | `kakuyomu` | per-work flag | daily / weekly / monthly / yearly / entire | `__NEXT_DATA__` Apollo scrape |
| AlphaPolis | `alphapolis` | per-work flag | hot only (top 20) | HTML scrape, two-step CSRF body fetch |

Reference: `docs/claude-design/`. Adult filtering goes through
`filterAdultContent(items, ctx)`; anonymous sessions are always SFW with
`Vary: Cookie` cache split on `/api/ranking`.

### API Surface

#### Discovery

- `POST /api/novels/register` — accepts URL or bare ID across all four sites
- `GET /api/ranking?scope=sfw|all|<site>&period=…` — single-list or grouped fan-out
- `POST /api/ranking/translate-titles`

#### Novel and Episode Management

- `GET /api/novels/[novelId]`
- `GET /api/novels/[novelId]/episodes`
- `POST /api/novels/[novelId]/ingest`
- `POST /api/novels/[novelId]/ingest-all` (resets `failed`+`fetching` rows; capped at MAX_FETCH_PER_RUN)
- `POST /api/novels/[novelId]/reingest-all`
- `GET /api/novels/[novelId]/jobs/current`
- `GET /api/novels/[novelId]/live-status` (parallelized; rate-limited; cached)
- `GET /api/novels/[novelId]/export?format=epub` (V5.8 — streaming JSZip)
- `POST /api/novels/[novelId]/episode-titles` (manual KO title override)

#### Translation

- `POST /api/novels/[novelId]/bulk-translate`
- `POST /api/novels/[novelId]/bulk-translate-all`
- `POST /api/novels/[novelId]/bulk-retranslate` (model-switch)
- `POST /api/novels/[novelId]/translate-session/abort`
- `POST /api/translations/episodes/[episodeId]/request`
- `GET /api/translations/episodes/[episodeId]/status`
- `GET /api/translations/episodes/[episodeId]/events` — SSE stream (Redis pub/sub)
- `DELETE /api/translations/episodes/[episodeId]/discard`
- `DELETE /api/novels/[novelId]/translations/discard`
- `GET /api/openrouter/models`
- `GET/PUT /api/translation-settings`
- `GET /api/translations/quality/summary` — public per-novel summary
- `GET /api/translations/quality/list` — public per-episode warning list

#### Glossary

- `GET/PUT/POST /api/novels/[novelId]/glossary`
- `GET/POST /api/novels/[novelId]/glossary/entries`
- `PUT/DELETE /api/novels/[novelId]/glossary/entries/[entryId]`
- `POST /api/novels/[novelId]/glossary/entries/import`
- `POST /api/novels/[novelId]/glossary/bootstrap` — JA-only morph mining
- `POST /api/novels/[novelId]/glossary/refresh` — incremental sample over translated range

#### Reader, Library, and Identity

- `GET /api/reader/episodes/[episodeId]`
- `GET /api/library`
- `POST/DELETE /api/library/[novelId]/subscribe`
- `PUT /api/progress`
- `GET/PUT /api/settings` (incl. `adultContentEnabled`)
- `POST /api/auth/sign-in`, `POST /api/auth/sign-out`, `GET /api/auth/session`, `GET /api/auth/csrf`
- `GET/POST /api/profiles`
- `GET/PUT/DELETE /api/profiles/active`
- `GET /api/stats` — V5.4 reading statistics

#### Admin and Jobs

- `GET /api/health`
- `GET /api/jobs/[jobId]`
- `GET /api/admin/jobs`
- `GET /api/admin/metrics`
- `GET/POST /api/admin/scheduled`
- `GET /api/admin/translations`
- `GET /api/admin/translations/quality`
- `GET /api/admin/translations/trends`

### Shared Components (selected)

- Discovery / nav: `Masthead`, `Eyebrow`, `LocaleProvider`, `LocaleSwitcher`,
  `ProfileSwitcher`, `ThemeToggle`, `SourcePill`, `StatusPill`.
- Library: `library/shelf-card`, `library/library-filters`, `MiniProgress`.
- Ranking: `ranking/ranking-hero`, `ranking/ranking-row`.
- Reader: `reader/chapter-heading`, `reader/compare-pane`,
  `reader/glossary-drawer`, `reader/glossary-toggle`, `reader/pacing-bar`,
  `reader/sticky-toolbar`, `reader/toolbar-overflow`.
- Home: `home/home-hero`, `home/feature-card`, `home/secondary-card`,
  `home/reading-stats-card`.
- Settings: `settings/segmented-control`, `settings/setting-row`,
  `settings/sidebar-nav`, `settings/theme-picker`.
- Translation/job UX: `TranslationToggle`, `EpisodeList`, `IngestButton`,
  `ModelPicker`, `NovelLiveSection`, `NovelTranslationInventory`,
  `NovelGlossaryEditor`, `EpisodeTranslationProgress`,
  `EpisodeTranslationBadge`, `PageAutoRefresh`, `NovelJobRefresh`,
  `ProgressTracker`, `OfflineBadge`, `RegisterSW`, `SubscribeButton`,
  `AuthStatus`, `NovelCover`.

### Domain Modules

- `source` — `SourceAdapter` registry + four site adapters (syosetu /
  nocturne / kakuyomu / alphapolis) + tolerant Apollo Zod parser +
  AlphaPolis body parser + canary script.
- `catalog` — novels, episodes, registration, ingest, ranking
  (single + grouped fan-out), live status, refresh metadata,
  adult filter, adult context.
- `library` — subscriptions, continue-reading, progress, home/library
  surfaces.
- `translation` — OpenRouter pipeline, sessions, glossary
  (bootstrap / promote / refresh / extract / validate-terms),
  quality validation, recover-stale, request-translation with dedup.
- `reader` — payload assembly + navigation context.
- `identity` — profiles, active session, guest migration, user-scoped
  settings.
- `jobs` — Redis-backed queue, worker runtime, lifecycle, recovery
  (boot-time aggressive + standing lenient), 9 job kinds incl.
  `glossary.bootstrap` and `catalog.translate-titles`.
- `events` — Redis pub/sub publisher for episode events.
- `export` — streaming JSZip EPUB builder.
- `admin` — metrics, scheduled tasks, quality/trend visibility.

## V5 Item Status

| Item | Status | Notes |
|---|---|---|
| V5.1 Quality Warnings Dashboard | Shipped | `quality/summary` + `quality/list` endpoints; admin views + public summary |
| V5.2 Incremental Glossary Refresh | Shipped | `/glossary/refresh` + sampling across translated range |
| V5.3 Selective Re-ingest by Checksum | Partial | `reingest-all` exists; full checksum skip not yet wired |
| V5.4 Reading Statistics Page | Shipped | `/stats` route + `/api/stats` |
| V5.5 SSE Live Updates | Foundation | Episode translation `events` SSE wired; novel-detail SSE pending |
| V5.6 Translation Comparison | Shipped | `compare-pane` + `?compare=` URL toggle |
| V5.7 PWA / Offline | Foundation | Service worker registered, offline badge; episode caching pending |
| V5.8 EPUB Export | Shipped | Streaming JSZip via `Readable.toWeb`, capped at MAX_EXPORT_EPISODES |
| V5.9 Favorite Models | Not started | |
| V5.10 Glossary Prompt Cap 200 | Shipped | env-overridable |

## Multi-Source Architecture (V5 milestone)

- `SourceAdapter` interface: `matchUrl`, `matchBareId`, `buildNovelUrl`,
  `buildEpisodeUrl`, `fetchNovelMetadata`, `fetchEpisodeList`,
  `fetchEpisodeContent`, `fetchRanking`.
- Registry (`src/modules/source/infra/registry.ts`) returns bare adapters;
  the global token-bucket decorator was removed after it caused stalls
  during ingest (see `docs/claude-design/08-known-gotchas.md`).
- `parseInput(userInput)` priority: URL match across all adapters → bare
  ncode (`n[0-9]+[a-z]+` → syosetu) → bare composite (`\d+/\d+` →
  alphapolis) → bare 19-digit (kakuyomu, best-effort).
- `getRankingSections(scope, period, ctx)` fans out with per-section
  2.5s timeout, returning `{ site, status: ok|timeout|error, items }`.
- Adult gate: `filterAdultContent(items, ctx)` at application layer.
  Anonymous (no profile) → SFW only. Authenticated path:
  `private, max-age=60, swr=300, Vary: Cookie`.
- Migrations 0024+0025: enum extension, `source_ncode` → `source_id`,
  composite unique on `(source_site, source_id)` via `CREATE UNIQUE
  INDEX CONCURRENTLY` + `ADD CONSTRAINT … USING INDEX`,
  `reader_preferences.adult_content_enabled boolean default true`.
- Drift detection: `pnpm canary` (`scripts/canary-source-fetch.ts`)
  fetches one canonical URL per non-API site; scheduled cron, not CI.

## Big-Novel Pipeline (commit 7f8b96d)

For 1000+ episode novels:

- `ingest-all` resets both `fetching` and `failed` to `pending` at run
  start so retry recovers stuck rows. `MAX_FETCH_PER_RUN = 5000` cap.
- `translate-novel-metadata` semaphore (`MAX_CONCURRENT = 3`).
- `live-status` rate-limited 60/min; `Cache-Control: max-age=2 swr=8`.
- `estimateTranslationProgress` parallelized (was sequential N+1).
- `episode-list` PAGE_SIZE 100 client pagination; per-row title-KO override
  via ✎ button when `titleMissing`.
- `build-epub` projects only required columns; `MAX_EXPORT_EPISODES = 3000`
  cap; `DISTINCT ON` for translations; `generateNodeStream` +
  `Readable.toWeb` streaming so a 1.14 MB body becomes 451 KB chunked.
- New job kind `catalog.translate-titles` so title translation no longer
  blocks `ingest-all`.
- Migration 0026: `CREATE INDEX CONCURRENTLY` on
  `translations(episode_id) WHERE target_language = 'ko'` via the new
  `-- migrate:no-transaction` directive.

## Glossary Cold-Start (Stages 1–3)

- **Stage 1 (`glossary.bootstrap` job, commit 633a319)** — JA-only
  morph mining via kuromoji; stratified episode sampling (first 3 +
  30%/60% windows + last 3); LLM extracts top candidates with
  hallucination guard (`parseBootstrapEntries` rejects `term_ja` not in
  candidate set); imports as `suggested` with confidence `0.4`.
- **Stage 2 (auto-promote, commit e64249d)** — every translation run
  calls `promoteSuggestedEntries(novelId, sourceText, translatedText,
  episodeNumber)` first. Pure planner returns `{ updates, counts }`.
  Reinforce delta `0.2`, weaken `0.1`, promote at `0.8`.
- **Stage 3 (review UI, commit 9f76b24)** — "Review" filter in glossary
  editor with `REVIEW_CONFIDENCE_MAX = 0.3`, amber tint, confidence
  badge (• 0.4 / ⚠ 0.1), quick-confirm ✓ button.

## Translation Length Hardening (commit c72f8bd)

- `extract-glossary` `max_tokens` 2048 → 4096; logs `finish_reason=length`.
- `quality-validation.ts` POSSIBLE_TRUNCATION heuristic rewritten:
  strip trailing whitespace + closing brackets/quotes/parens, check last
  3 chars for verb endings (다요죠지까네군자임음됨함) / punctuation /
  ellipsis / `(계속)` / `끝`. Two regression tests added for
  dialogue-tail false positives (ep 232 sample).
- Translation request dedup: in-flight against any model with same
  episode (5-min stale fall-through).
- Worker boot-time recovery: `recoverAbandonedTranslationsAtStartup` +
  `recoverStaleRunningJobs(startupStaleAfterMs = 30s)`. Standing
  recovery threshold `STALE_AFTER_MS` 30 min → 10 min. Handles NULL
  `processingStartedAt` via `or(isNull, lt(cutoff))`.

## UI / Visual Pass

- **Editorial × cozy paper redesign** (commit c9f3281) — paper / sepia /
  night themes via `data-theme` selector. `frame-paper` and
  `frame-night` wrappers; paper-grain and night-grain texture layers;
  `--accent-leaf` (paper) and `--accent-warm` (night).
- **KR-primary throughout** (commit 9b9dcf0) — episode-scoped glossary,
  Korean titles primary on novel hero, ranking row, library card,
  reader chapter heading.
- **Frame-paper/night theme-aware** (commit c7c57a2) — backgrounds
  adopt `--background` so theme switches don't leak.
- **Reader glossary show/hide toggle** (commit 55cd99c) —
  `[data-glossary="hide"]` collapses the drawer column.
- **Manual KO title override** (commit 208b53a) — per-episode KO title
  upsert via `title_translation_cache` for content-safety-refused titles.

## Key Implementation Details

- Reader font and layout preferences live in the per-device `reader-prefs`
  cookie, not in the database. `/api/settings` only owns locale,
  `readerLanguage`, `theme`, and `adultContentEnabled`.
- Async ingest, glossary, sessions, extraction, translation, and
  bootstrap run through Redis-backed `pnpm worker`.
- Translation sessions carry rolling context summaries across episodes
  and auto-pause on `TRANSLATION_COST_BUDGET_USD`.
- V3 quality validation stores `quality_warnings` JSONB on translations
  for empty output, suspicious length, untranslated segments, paragraph
  mismatch, possible truncation, glossary mismatch, chunk-duplicate.
- Heavy novel-scoped actions use request-deduplication locks.
- OpenRouter model and pricing metadata flow through a shared cache.
- Library cards track `hasNewEpisodes` and translated cost/status.
- Translated novel titles and summaries are persisted to the `novels`
  table.

## Verification

- `pnpm typecheck` passes
- `pnpm test` passes: `192/192` Vitest tests across `29` files
  (last green: commit `c72f8bd`, 2026-04-28)
- `pnpm build` passes
- `pnpm canary` exists for live-fetch drift detection (cron-driven)
- Browser smoke coverage in `tests/browser/smoke.spec.ts`

## Current Gaps

- V5.3 selective re-ingest still re-fetches broadly (no checksum skip).
- V5.5 SSE landed for episode translation events; novel-detail
  consolidated polling (`live-status`) has not yet been replaced by SSE.
- V5.7 PWA: service worker registered and offline badge in place; full
  episode caching strategy not implemented.
- V5.9 favorite-models pinning not started.
- Rate limiting still keys off forwarded IP headers; not yet covering
  every mutation route.

## Recommended Next Actions

1. **V5.3 Checksum-aware re-ingest** — close the last big-novel gap by
   wiring per-episode source-side timestamps into `reingest-all`.
2. **V5.5 finish: novel-detail SSE** — replace 5s polling with the
   already-built Redis pub/sub fanout.
3. **V5.7 PWA: offline episode cache** — service worker is registered;
   ship the runtime-cache strategy for translated episode payloads.
4. **V5.9 favorite-models** — share `<ModelPicker>` across settings,
   glossary editor, comparison picker.
5. **Rate-limit coverage audit** — extend durable rate limiting to the
   last cluster of mutation routes (export, retranslate, override).
