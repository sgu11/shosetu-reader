# Progress

Last updated: 2026-04-14

---

## Implementation Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation (Next.js, DB, env, logging) | Done |
| 1 | Data Model and Core Contracts | Done |
| 2 | Source Registration Foundation | Done |
| 3 | Episode Ingestion and Reader Baseline | Done |
| 3.5 | Design System Integration (dark-mode-native) | Done |
| 4 | Library and Progress | Done |
| 5 | Translation Pipeline | Done |
| 6 | Ranking Discovery | Done |
| 7 | Hardening and Docker | Done |

---

## Acceptance Criteria (v1-goal.md §7)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Register novel via URL or ncode | Done | POST /api/novels/register |
| Read ingested Japanese episodes | Done | Reader with configurable fonts, prev/next nav |
| Subscriptions and continue-reading | Done | Subscribe/unsubscribe, resume reading with scroll/language/progress restoration |
| Korean translation request and read | Done | Translation pipeline with model selection, retry, discard, inventory, and Redis-backed durable queue |
| UI supports English and Korean | Done | EN/KR dictionaries, locale switcher, cookie persistence |
| System runs with PostgreSQL and Redis, Docker-ready | Done | PostgreSQL, Redis worker, and Docker Compose are in place |

---

## What's Built

### API Routes (41 endpoints across 41 route files)
- `GET  /api/health`
- `POST /api/novels/register`
- `GET  /api/novels/[novelId]`
- `GET  /api/novels/[novelId]/episodes`
- `POST /api/novels/[novelId]/ingest`
- `POST /api/novels/[novelId]/ingest-all`
- `POST /api/novels/[novelId]/reingest-all`
- `POST /api/novels/[novelId]/bulk-translate`
- `POST /api/novels/[novelId]/bulk-translate-all`
- `POST /api/novels/[novelId]/translate-session/abort`
- `GET/PUT/POST /api/novels/[novelId]/glossary`
- `GET/POST /api/novels/[novelId]/glossary/entries`
- `PUT/DELETE /api/novels/[novelId]/glossary/entries/[entryId]`
- `POST /api/novels/[novelId]/glossary/entries/import`
- `GET  /api/novels/[novelId]/jobs/current`
- `GET  /api/novels/[novelId]/live-status`
- `GET  /api/reader/episodes/[episodeId]`
- `POST/DELETE /api/library/[novelId]/subscribe`
- `GET  /api/library`
- `PUT  /api/progress`
- `POST /api/translations/episodes/[episodeId]/request`
- `GET  /api/translations/episodes/[episodeId]/status`
- `DELETE /api/translations/episodes/[episodeId]/discard`
- `DELETE /api/novels/[novelId]/translations/discard`
- `GET/PUT /api/translation-settings`
- `GET  /api/openrouter/models`
- `GET  /api/ranking`
- `POST /api/ranking/translate-titles`
- `GET/PUT /api/settings`
- `GET  /api/admin/jobs`
- `GET  /api/admin/metrics`
- `GET/POST /api/admin/scheduled`
- `GET  /api/admin/translations`
- `GET  /api/admin/translations/quality`
- `GET  /api/admin/translations/trends`
- `POST /api/auth/sign-in`
- `POST /api/auth/sign-out`
- `GET  /api/auth/session`
- `GET/POST /api/profiles`
- `GET/PUT/DELETE /api/profiles/active`
- `GET  /api/jobs/[jobId]`

### Pages (9 screens + framework `_not-found`)
- Home (hero + continue reading with translated titles)
- Register novel
- Novel detail (live-status episode list, subscribe, unified actions menu, glossary editor)
- Reader (JA/KR toggle, progress tracker, prev/next nav, per-device font settings)
- Library (subscribed novels with progress)
- Ranking (daily/weekly/monthly/quarterly tabs with title translation)
- Settings (locale, theme, translation model picker, global prompt)
- Profiles (create, switch, guest revert)
- Sign-in (redirects to profiles)

### Components (19 shared components)
- IngestButton — unified actions dropdown (ingest + translate)
- ReaderSettings — per-device cookie-based font/layout preferences
- SubscribeButton — subscribe/unsubscribe toggle
- TranslationToggle — JA/KR toggle with model selector and re-translate
- NovelPromptEditor — per-novel translation prompt editor
- ProgressTracker — automatic reading progress persistence
- LocaleProvider — i18n context provider
- LocaleSwitcher — EN/KR pill toggle
- Nav — top navigation bar
- ProfileSwitcher — active profile display and management link
- AuthStatus — session authentication status
- NovelTranslationInventory — per-novel translation breakdown and discard controls
- NovelGlossaryEditor — structured glossary CRUD + style guide generation
- NovelJobRefresh — current novel job progress strip
- EpisodeList — live episode fetch/translation state list
- EpisodeTranslationBadge — per-episode translation progress pill
- NovelLiveSection — consolidated novel live polling surface
- PageAutoRefresh / refresh helpers — remaining lightweight polling utilities

### Modules (9 domains)
- source — Syosetu API/HTML integration
- catalog — novel and episode domain
- library — subscriptions, progress, continue-reading
- translation — translation pipeline with OpenRouter
- reader — reader content assembly
- identity — default user and preference scaffolding
- jobs — schema and placeholders for background job orchestration
- admin — ops visibility endpoints for jobs and translations

### Key Implementation Details
- **Reader font settings**: stored in per-device cookie (`reader-prefs`, 1-year expiry), not in database — allows different settings per device
- **Translation model**: configurable via Settings page with OpenRouter model picker
- **Per-novel glossary & style guide**: structured glossary entries plus prose style guide, shared novel-wide
- **Bulk operations**: ingest, re-ingest, translate-all, session abort, and glossary generation run through the durable job system
- **Multi-user**: Profile-based user scoping with guest data migration; session auth scaffolded
- **Reader resume**: Scroll anchor + percent-based restoration with language persistence
- **Rate limiting**: Redis-backed rate limiting with in-memory fallback, plus request dedupe for expensive routes
- **Title translation**: episode and ranking titles translated and cached in DB
- **OpenRouter metadata cache**: shared cached model/pricing lookup used by settings, model listing, and cost estimation
- **Live novel status**: novel detail polling is consolidated through `/api/novels/[novelId]/live-status`
- **Operational counters**: admin metrics now expose queue lag, retries, stale recoveries, rate-limit hits, deduped requests, and OpenRouter usage/error counters
- **Fonts**: 6 font families (Noto Serif JP, Nanum Myeongjo, Nanum Gothic, NanumBarunGothic, MaruBuri, Pretendard), 3 weights (Normal, Bold, Extra Bold)
- **i18n**: EN/KR dictionaries with cookie-based locale persistence, Korean as default

### Tests
- 61 tests across 12 files
- Coverage: ncode parsing, input schemas, episode scraping, Syosetu API, library schemas, translation schemas, identity schemas, catalog schemas, reader schemas, translation discard schemas

---

## V2 Implementation Plan

### V2 Scope Additions
- **Multi-user support**: personalized settings, prompts, subscriptions, library state, and continue-reading per user
- **Status overview**: fetched/translated episode counts on library and novel detail, including per-model translation counts
- **Translation discard controls**: remove stale or low-quality translations to support clean re-translation
- **Top-bar model visibility**: show current model prominently and allow quick switching from the reader chrome
- **Cost estimation**: estimate OpenRouter translation cost per episode and aggregate it at the novel level
- **Live background updates**: fetching/translation progress should update in-page without manual refresh
- **Translation progress estimation**: progress bar based on average throughput and request size history

### V2.1 Baseline Stabilization — Done
- `pnpm test` (56 tests), `pnpm check`, and `pnpm build` all green
- Documentation updated to match code
- Tests cover identity schemas, translation discard schemas, catalog schemas, reader schemas

### V2.2 Multi-User Foundation — Done
- Profile creation and selection via `/profiles` page
- `resolveUserId()` replaces `ensureDefaultUser()` in all business logic
- Settings, subscriptions, progress, translation settings, prompts scoped per user
- Guest data migration with atomic transactions (preferences, subscriptions, progress)
- Session auth API scaffolded (`/api/auth/*`)

### V2.3 Durable Async Work — Done
- Redis-backed queue adapter added behind the shared `JobQueue` port
- Dedicated worker runtime (`scripts/worker.ts`) processes jobs outside request lifetimes
- `job_runs` tracks queue lifecycle, progress updates, retries, and recovery metadata
- Ingest-all, bulk-translate-all, and single-episode translation all use the queue path
- Docker Compose now includes `redis` and a separate `worker` service

### V2.4 Reader Resume Loop — Done
- Saved progress returned in reader payload (language, scroll anchor, progress percent)
- Scroll restoration with anchor-based lookup and percent fallback (8 retries)
- Language preference restored from progress
- Continue-reading on home page aligned with reader state

### V2.5 Library and Novel Status Overview — Done
- Per-novel episode counters: fetched/total with batch queries
- Translation counters: translated episodes count
- Per-model translation counts (grouped, sorted by count)
- Status badges on library cards and novel detail page

### V2.6 Translation Inventory and Control — Done
- Discard translations by episode (`DELETE /api/translations/episodes/[episodeId]/discard`)
- Discard translations by novel (`DELETE /api/novels/[novelId]/translations/discard`)
- Filter by model name or translation ID
- NovelTranslationInventory component with per-model breakdown
- In-reader per-translation discard via model dropdown
- Latest available translation preserved while new one processes

### V2.7 Model Visibility and Quick Switching — Done
- Current model shown in reader top bar pill button
- Model dropdown with available translations, switch, retranslate, discard
- Configured default model distinguished from currently displayed model
- Link to settings for model configuration

### V2.8 Cost Estimation and Observability — Done
- OpenRouter model/pricing metadata cached through a shared lookup path with durable cache support
- Token usage (input/output) captured from OpenRouter response
- Per-translation estimated cost calculated and persisted in DB
- Cost aggregation at novel level (total + per-model) in status overview
- Costs displayed in: translation inventory, novel detail badges, library cards, reader model dropdown
- EN/KO i18n keys for all cost labels

### V2.9 Live Updates and Progress Estimation — Done
- Poll-based live refresh is now active on library and novel detail pages
- Novel detail live updates are consolidated through `/api/novels/[novelId]/live-status`
- Processing translation status now returns ETA/progress estimates based on historical timing data
- ETA estimation improved: cross-model fallback when per-model samples insufficient, median-based calculation, variance-aware confidence scoring
- Per-episode translation progress bars in novel detail episode list
- Active translation count badges on library cards and novel detail status
- Admin translation trends endpoint (`/api/admin/translations/trends`) with per-model speed, percentiles, failure rates
- SSE deferred: polling covers the product loop adequately

### V2.10 Follow-on Work — Done
1. **Scheduled jobs** — metadata refresh job (`catalog.metadata-refresh`) with admin trigger endpoint (`/api/admin/scheduled`)
2. **Metrics** — unified admin metrics dashboard (`/api/admin/metrics`) with queue health, translation throughput (24h/7d/all), recent jobs, system overview
3. **Light theme** — full light mode with CSS custom properties, cookie-persisted `data-theme` toggle in nav and settings

## Deferred to Post-V2

### Valid but Not Blocking Ship
1. **SSE/WebSocket live updates** — polling covers the product loop; revisit if latency becomes a problem
2. **External observability** — Prometheus/Grafana can layer on the existing DB-backed metrics
3. **Ranking scheduled sync** — infrastructure exists (`/api/admin/scheduled`); add a ranking sync task when needed

## Completed V2 Phases
- V2.1 Baseline Stabilization ✅
- V2.2 Multi-User Foundation ✅
- V2.3 Durable Async Work ✅
- V2.4 Reader Resume Loop ✅
- V2.5 Library and Novel Status Overview ✅
- V2.6 Translation Inventory and Control ✅
- V2.7 Model Visibility and Quick Switching ✅
- V2.8 Cost Estimation and Observability ✅
- V2.9 Live Updates and Progress Estimation ✅
- V2.10 Follow-on Work ✅

---

## V3 — Translation Quality & Context

Full spec: [`docs/v3-architecture.md`](docs/v3-architecture.md)

V3 addresses three structural weaknesses: static glossaries, isolated episode
translation, and unoptimized API usage. The goal is higher translation quality
and lower cost per episode.

### V3 Scope

1. **Structured glossary with living updates** — Replace the free-text markdown
   glossary with a structured term table (character names, places, skills) plus
   a separate style guide. Auto-extract new terms after each episode translation.
   Glossary entries remain shared novel-wide across all profiles.
2. **Translation sessions with context chaining** — Bulk translations carry a
   rolling summary forward so the model maintains character, plot, and tone
   consistency across episodes.
3. **Prompt caching & request optimization** — Restructure prompts for maximum
   cache-hit rates. Optimize first for Gemini on OpenRouter while keeping room
   for alternate models. Chunk long episodes intelligently. Adaptive token
   limits.
4. **Post-translation quality validation** — Automated checks for empty output,
   length anomalies, untranslated segments, and glossary compliance.

### V3 Phases

| Phase | Description | Status |
|-------|-------------|--------|
| V3.1 | Structured Glossary Foundation | Done |
| V3.2 | Post-Translation Glossary Extraction | Done |
| V3.3 | Translation Sessions & Context Chaining | Done |
| V3.4 | Prompt Caching & Request Optimization | Done |
| V3.5 | Quality Validation & Observability | Done |

### V3 Key Architectural Decisions
- `novel_glossary_entries` table with per-term CRUD, category, status (confirmed/suggested/rejected)
- `translation_sessions` table grouping sequential bulk translations with rolling context summary
- Post-translation `glossary.extract` background job for auto-term extraction
- `translation.session-summary` background job for rolling context generation
- Multi-message prompt structure: system (cached) → context (per-session) → source (per-episode)
- Episode chunking at paragraph boundaries with overlap context for long episodes
- `quality_warnings` JSONB column on translations for automated defect detection
- `promptVersion` bumped to `"v3"` for session-based translations only

---

## V4 — Hardening, Performance, and API Efficiency

Full implementation plan: [`PLAN_V4.md`](../PLAN_V4.md)

V4 focused on operational hardening rather than feature expansion. The goal was
to reduce duplicated work, lower OpenRouter spend, tighten hot query paths, and
make live updates cheaper to run.

### V4 Status

| Area | Status |
|------|--------|
| Durable rate limiting & request dedupe | Done |
| Consolidated novel live-status polling | Done |
| Query/index tuning for hot paths | Done |
| Shared OpenRouter model/pricing cache | Done |
| Async glossary generation jobs | Done |
| Expanded operational metrics | Done |
| Persist translated novel metadata | Done |
| Workload-specific model routing | Done |
| New-episode detection on library | Done |
| Batch title translation on ingest | Done |
| Prompt caching awareness | Done |
| Translation cost budget | Done |

### V4 Highlights
- Redis-backed rate limiting with in-memory fallback in `src/lib/rate-limit.ts`
- Request dedupe locks for heavy novel-scoped actions (`ingest-all`, `reingest-all`, `bulk-translate`, `bulk-translate-all`, glossary generation)
- Shared OpenRouter model/pricing cache used by `/api/openrouter/models`, translation settings validation, and cost estimation
- New novel live-status endpoint: `GET /api/novels/[novelId]/live-status`
- Novel detail polling simplified to one client live section instead of overlapping job and per-episode pollers
- Ranking lookup batched against `novels.source_ncode`
- Continue-reading episode lookup collapsed into the main query
- Latest translation lookup switched to `selectDistinctOn(...)` instead of a correlated subquery
- New DB indexes added in `drizzle/0018_v4_indexes.sql` for episodes, translations, jobs, sessions, and glossary entries
- Glossary generation moved onto the job queue as `glossary.generate`
- Admin metrics expanded with queue lag, retry summary, stale recovery counts, rate-limit hits, dedupe hits, and OpenRouter usage/error counters
- Novel `titleKo`/`summaryKo` persisted back to `novels` table after first translation, eliminating redundant LLM calls
- Workload-specific model routing: `OPENROUTER_SUMMARY_MODEL`, `OPENROUTER_EXTRACTION_MODEL`, `OPENROUTER_TITLE_MODEL` env vars with fallback to default
- `hasNewEpisodes` detection on library cards: tracks `lastCheckedEpisodeCount` on subscriptions, clears on novel detail visit
- Batch title translation after `ingest-all` job completes, so first novel page load is instant
- Prompt caching hints: `cache_control` breakpoints for Anthropic models, cache hit/miss logging from OpenRouter response
- Translation cost budget: `TRANSLATION_COST_BUDGET_USD` env var, `costBudgetUsd` on sessions, auto-pauses session when exceeded

### Verification
- `pnpm check` ✅
- `pnpm test` ✅ (`61` tests)
- `pnpm build` ✅
- `drizzle/0018_v4_indexes.sql` applied and verified against the local database
- `drizzle/0019_v4_new_episodes_and_budget.sql` applied and verified against the local database
- Browser QA: library page shows "새 에피소드" badge, settings page loads, no console errors
