# Progress

Last updated: 2026-04-17

## Current Snapshot

- Product status: V1-V4 are implemented; V5 is planned and tracked in
  [docs/v5-plan.md](v5-plan.md).
- Repo shape today: `41` API route files, `19` shared components, `8` domain
  modules, `20` SQL migrations, and `61` Vitest tests across `11` files.
- The highest-signal recent milestone is V4: durable rate limiting and request
  dedupe, consolidated live-status polling, query/index tuning, shared
  OpenRouter metadata caching, async glossary generation, translation cost
  budgeting, and expanded operational metrics.

## Phase Status

| Phase | Scope | Status |
|-------|-------|--------|
| V1 | Foundation, registration, ingestion, reader baseline, library | Done |
| V2 | Profiles, durable jobs, live updates, translation inventory, admin APIs | Done |
| V3 | Structured glossary, session context chaining, chunking, quality validation | Done |
| V4 | Hardening, performance, cost control, and operational visibility | Done |
| V5 | New user-facing capabilities and architectural upgrades | Planned |

## What Exists Today

### Pages

- Home
- Library
- Ranking
- Register
- Novel detail
- Reader
- Settings
- Profiles
- Sign-in

### API Surface

#### Discovery

- `POST /api/novels/register`
- `GET /api/ranking`
- `POST /api/ranking/translate-titles`

#### Novel and Episode Management

- `GET /api/novels/[novelId]`
- `GET /api/novels/[novelId]/episodes`
- `POST /api/novels/[novelId]/ingest`
- `POST /api/novels/[novelId]/ingest-all`
- `POST /api/novels/[novelId]/reingest-all`
- `GET /api/novels/[novelId]/jobs/current`
- `GET /api/novels/[novelId]/live-status`

#### Translation

- `POST /api/novels/[novelId]/bulk-translate`
- `POST /api/novels/[novelId]/bulk-translate-all`
- `POST /api/novels/[novelId]/translate-session/abort`
- `POST /api/translations/episodes/[episodeId]/request`
- `GET /api/translations/episodes/[episodeId]/status`
- `DELETE /api/translations/episodes/[episodeId]/discard`
- `DELETE /api/novels/[novelId]/translations/discard`
- `GET /api/openrouter/models`
- `GET/PUT /api/translation-settings`

#### Glossary

- `GET/PUT/POST /api/novels/[novelId]/glossary`
- `GET/POST /api/novels/[novelId]/glossary/entries`
- `PUT/DELETE /api/novels/[novelId]/glossary/entries/[entryId]`
- `POST /api/novels/[novelId]/glossary/entries/import`

#### Reader, Library, and Identity

- `GET /api/reader/episodes/[episodeId]`
- `GET /api/library`
- `POST/DELETE /api/library/[novelId]/subscribe`
- `PUT /api/progress`
- `GET/PUT /api/settings`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET /api/auth/session`
- `GET/POST /api/profiles`
- `GET/PUT/DELETE /api/profiles/active`

#### Admin and Jobs

- `GET /api/health`
- `GET /api/jobs/[jobId]`
- `GET /api/admin/jobs`
- `GET /api/admin/metrics`
- `GET/POST /api/admin/scheduled`
- `GET /api/admin/translations`
- `GET /api/admin/translations/quality`
- `GET /api/admin/translations/trends`

### Shared Components

- `AuthStatus`
- `EpisodeList`
- `EpisodeTranslationBadge`
- `EpisodeTranslationProgress`
- `IngestButton`
- `LocaleProvider`
- `LocaleSwitcher`
- `Nav`
- `NovelGlossaryEditor`
- `NovelJobRefresh`
- `NovelLiveSection`
- `NovelTranslationInventory`
- `PageAutoRefresh`
- `ProfileSwitcher`
- `ProgressTracker`
- `ReaderSettings`
- `SubscribeButton`
- `ThemeToggle`
- `TranslationToggle`

### Domain Modules

- `source` — Syosetu API and scraping integration
- `catalog` — novels, episodes, registration, ingest, ranking, live status
- `library` — subscriptions, continue-reading, progress, home/library surfaces
- `translation` — OpenRouter pipeline, sessions, glossary, quality validation, cost tracking
- `reader` — reader payload assembly and navigation context
- `identity` — profiles, active session state, guest migration, user-scoped settings
- `jobs` — queue adapter, worker runtime, job lifecycle, recovery
- `admin` — metrics, scheduled tasks, translation quality/trend visibility

## Key Implementation Details

- Reader font and layout preferences live in the per-device `reader-prefs`
  cookie, not in the database.
- `/api/settings` only owns locale, `readerLanguage`, and theme. Reader font
  settings stay cookie-based by design.
- Async ingest, glossary generation, session summaries, glossary extraction, and
  translation work run through the Redis-backed queue and `pnpm worker`.
- Translation sessions carry rolling context summaries across episodes and can be
  auto-paused when `TRANSLATION_COST_BUDGET_USD` is exceeded.
- V3 quality validation stores `quality_warnings` JSONB on translations for
  empty output, suspicious length, untranslated segments, paragraph mismatch,
  possible truncation, glossary mismatch, and chunk-duplicate detection.
- Heavy novel-scoped actions use request-deduplication locks to prevent repeated
  clicks from starting duplicate work.
- OpenRouter model and pricing metadata flow through a shared cache used by
  model listing, validation, and cost estimation.
- Novel detail live updates are consolidated through
  `/api/novels/[novelId]/live-status` rather than overlapping polling paths.
- Library cards track `hasNewEpisodes` and translated cost/status summaries.
- Translated novel titles and summaries are persisted to the `novels` table to
  avoid repeated metadata translation.

## Verification

- `pnpm typecheck` passes
- `pnpm test` passes: `61` tests across `11` Vitest files
- `pnpm build` passes
- Browser smoke coverage exists in `tests/browser/smoke.spec.ts` for:
  - top-nav rendering on home/library/profiles
  - profile creation activating the visible profile state
  - small-screen navigation usability
  - friendly validation feedback on profile creation

## Current Gaps

- Translation quality warnings are available through the admin API, but they are
  not yet surfaced on the novel detail page or reader UI.
- `reingest-all` exists, but it still re-fetches broadly instead of skipping
  unchanged episodes by checksum or upstream metadata.
- Reading analytics are present in the database but do not yet have a user-facing
  `/stats` surface.
- Live updates still rely on polling; SSE is planned but not implemented.
- Rate limiting is durable, but it still keys off forwarded IP headers and does
  not yet cover every mutation route that carries cost or abuse risk.

## Recommended Next Actions

1. **Ship V5.1: Quality Warnings Dashboard**
   Surface existing `quality_warnings` data on novel detail and in the reader.
   This is the fastest high-value feature because the backend data already
   exists.

2. **Ship V5.3: Selective Re-ingest by Checksum**
   Reduce needless Syosetu fetches, shorten maintenance jobs, and make
   `reingest-all` practical for large novels.

3. **Ship V5.4: Reading Statistics Page**
   Add a visible new user-facing capability without touching the translation
   pipeline. The required data already exists in reading progress and
   translation tables.

4. **Do an ops/security hardening pass on rate-limit trust and coverage**
   Tighten proxy IP resolution, add coverage to the remaining costly mutation
   routes, and keep abuse resistance aligned with the growing translation
   surface.
