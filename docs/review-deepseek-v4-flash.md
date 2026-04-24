# Code Review: Shosetu Reader (deepseek-v4-flash)

> Review date: 2026-04-24
> Scope: Full-stack Next.js 16 + Drizzle ORM + OpenRouter translation pipeline

---

## 1. Architecture Overview

**Strengths:**

- Clean modular monolith with clear domain/application/infra/api layering per module
- Strong use of `@/` path aliases for clean imports
- Zod validation at every boundary (env, API input, DB schemas)
- Effective separation of background jobs (Redis queue) from request-response path
- i18n system with cookie-based locale persistence is lightweight and effective

**Weaknesses:**

- `request-translation.ts` (638 lines) violates the ~200-line guideline in AGENTS.md
- `translation-sessions.ts` (519 lines) similarly overlong
- `glossary-entries.ts` (293 lines) does both CRUD and eviction logic — could be split
- `novel-glossary-editor.tsx` (~570 lines) is a monolith component doing data fetching, form state, polling, model picker, and rendering all in one file

---

## 2. Module Structure & Layering

Each module follows the convention: `domain/ → application/ → infra/ → api/`.

**Good patterns observed:**

- `source/ncode.ts` is a pure domain module with no DB/infra dependencies — ideal
- `provider.ts` (translation) defines clean interfaces (`TranslationProvider`, `TranslationRequest`, `TranslationResult`)
- `job-handlers.ts` cleanly maps `JobKind` string literals to handler functions
- API route files (e.g. `routes.ts`) are thin — they delegate to application layer

**Issues:**

- `render-glossary-prompt.ts` is in `translation/application/` — it's a pure rendering function, could be in `domain/`
- `request-translation.ts` mixes application logic with low-level `splitSourceInHalf` (line 267) — the truncation recovery algorithm (lines 298-353) could be extracted to `chunk-episode.ts`
- Several application services call `getDb()` directly instead of accepting a DB instance — makes testing harder

---

## 3. Translation Pipeline

**Well-designed:**

- Deduplication via unique index `translations_identity_idx` + `onConflictDoNothing` — race-condition-safe
- Truncation recovery with binary split and recursion is robust
- Chunking algorithm (`chunk-episode.ts`) gracefully degrades: `\n\n` → `\n` → sentence boundaries → hard cut
- Preface/afterword translation isolation (separate calls to avoid context contamination) — excellent design choice
- Quality validation (`quality-validation.ts`) runs post-translation checks without blocking delivery — 7 heuristic checks including untranslated segments, length ratio, paragraph mismatch, glossary compliance, chunk boundary artifacts
- Session-based translation with rolling context summary enables cross-episode consistency
- Cost budget enforcement (`session.costBudgetUsd`) prevents runaway spending
- Ordering guard (`expectedNextIndex`) prevents out-of-order advances

**Issues:**

- `MAX_SPLIT_DEPTH = 3` is hardcoded — should be configurable
- `CHUNK_THRESHOLD = 12_000` and `TARGET_CHUNK_SIZE = 8_000` are hardcoded magic numbers
- Session advance error handling catches all errors and continues — could mask systematic failures
- `translation-sessions.ts` line 149: `session.costBudgetUsd != null && session.totalCostUsd >= session.costBudgetUsd` — floating point comparison could miss boundary cases
- After translation success, glossary extraction is enqueued non-fatally (line 578-601) — but the try/catch wraps the DB read too, so a transient DB error silences the entire extraction

---

## 4. Job System

**Well-designed:**

- Dual queue implementation: Redis (`redis-job-queue.ts`) for production, in-memory (`inline-job-queue.ts`) for dev/testing
- Stale job recovery (line 207 of `job-runtime.ts`) — 30-min timeout with automatic requeue
- Exponential backoff for retries (`getRetryDelayMs`)
- `JobExecutionContext` abstraction allows progress reporting via `updateProgress`
- Separation of `enqueued-job.ts` (domain) from `job-runs.ts` (infra) is clean

**Issues:**

- `job-runtime.ts` uses `process.on("SIGINT")` and `process.on("SIGTERM")` without handling `SIGHUP` — relevant for Docker deployments
- `blPop` with 5-second timeout means the worker polls every 5 seconds even when idle — acceptable but not optimal
- `moveDelayedJobsToPending` has no global lock — multiple workers could race on `zRem` + `rPush`
- `reconcileQueuedJobs` enqueues jobs without checking if they're already in the pending list — could cause duplicate processing
- Stale recovery checks `startedAt` but doesn't verify the job is actually still running (pod could have been killed mid-flight)

---

## 5. Identity & Auth

**Well-designed:**

- `resolveUserContext()` (49 lines) is concise and well-layered
- Profile system with guest-to-authenticated migration (`guest-profile-migration.ts`)
- Session cookies with explicit domain types (`session-cookie.ts`, `active-profile-cookie.ts`)
- Default user fallback (`default-user.ts`) is pragmatic for an MVP

**Issues:**

- `resolveUserId()` calls `resolveUserContext()` then discards everything except `userId` — wasteful DB query
- `ensureDefaultUser()` in `default-user.ts` creates a default user on every first access — this is a potential vector for user table bloat if called concurrently
- No rate limiting on auth endpoints (sign-in)
- `session-auth.ts` — no CSRF protection noted

---

## 6. Database Schema

**Well-designed:**

- Consistent `uuid()` primary keys with `defaultRandom()`
- Proper `onDelete: "cascade"` on foreign keys
- Smart composite indexes for common query patterns
- Unique index on `translations_identity_idx` prevents duplicate translation requests
- Enum types for status fields (PostgreSQL enums via Drizzle)
- Quality warnings stored as JSONB — flexible but typed

**Issues:**

- `translations` table has no index on `sessionId` — session queries would sequential scan
- `translationSessions.creatorUserId` references `users.id` but has no FK constraint — orphaned rows possible
- `novelGlossaries.novelId` is `UNIQUE` but not marked as `REFERENCES novels.id` — review line 134-137, it does have FK
- `episodes.rawHtmlChecksum` is `text` — a fixed-length `char(16)` would be more appropriate for SHA-256 truncated to 16 chars
- No index on `episodes.sourceEpisodeId` alone (only composite with novelId) — standalone lookups on sourceEpisodeId would scan
- `translationSettings.favoriteModels` uses PostgreSQL array type — less portable, and no index on array elements

---

## 7. Source Integration (Syosetu)

**Well-designed:**

- Clean `ncode.ts` domain with validation (`parseNcode`, `isValidNcode`) — extracts ncode from both bare codes and URLs
- Cheerio-based scraping handles edge cases: pagination, preface/afterword separation, checksum-based change detection
- `fetchEpisodeContent` correctly separates `.p-novel__text.p-novel__text--preface` from body text using `.not()` selectors
- Rate limiting (1s delay between fetches) respects Syosetu's terms
- `fetchAndReconcileEpisode` enables selective re-ingest — skips DB writes for unchanged episodes

**Issues:**

- `fetchNovelMetadata` uses `zod.parse` (throws on invalid data) while `fetchRanking` uses `zod.safeParse` (skips invalid) — inconsistent error handling
- `fetchEpisodeContent()` doesn't handle the case where the main body div is empty (no `<p>` tags) — returns empty string silently
- No retry logic for network failures in `fetchPage()` — a single timeout fails the entire ingest
- `parseLastPage()` looks for CSS class `c-pager__item--last` — if Syosetu changes their class names, the entire TOC pagination breaks

---

## 8. API Routes & Validation

**Well-designed:**

- Zod schemas in `api/schemas.ts` per module, tested against in `tests/`
- SSE endpoint (`events/route.ts`) with Redis pub/sub — clean separation of subscription management from event publishing
- Shared Redis subscription channel with per-channel refcounted handlers — avoids the "one socket per SSE tab" leak from prior design
- Heartbeat interval keeps SSE connections alive
- `apiError()` helper suppresses internal details in production

**Issues:**

- SSE stream has no backpressure handling — if Redis publishes faster than the client consumes, memory grows unbounded
- No authentication check on SSE endpoint — any client knowing the episodeId could subscribe
- `GET /api/translations/episodes/[episodeId]/request/route.ts` does a write operation (creates translation job) — violates REST convention, should be POST
- `GET /api/novels/[novelId]/glossary` at line `?estimate=true` is a query parameter toggle — mixing glossary fetch with cost estimation in one endpoint is awkward

---

## 9. Frontend Components

**Well-designed:**

- `compare-pane.tsx` has clean row alignment algorithm with blank-source rows as visual gaps — prevents one model's extra newlines from shifting downstream alignment
- `EpisodeList` handles all fetch statuses and translation statuses gracefully
- `NovelGlossaryEditor` has comprehensive UX: inline editing, category filter tabs with counts, pagination, model picker, cost estimation, job polling
- Consistent use of `useTranslation()` for i18n
- Tailwind CSS 4 with dark-mode-native design

**Issues:**

- `NovelGlossaryEditor` is ~570 lines — should be split: data layer (custom hooks), sub-components (AddEntryForm, EntryTable, StyleGuideEditor, ModelPicker)
- Toast notification positioned `fixed right-4 top-4` — overlaps with nav; no z-index stacking context
- `EpisodeList` line 39: `void novelId` — prop is destructured but not used; should be removed from interface or used meaningfully
- Polling for glossary generation uses `setInterval(5000)` with `document.visibilityState` check — good practice, but the polling doesn't debounce tab switches
- No loading skeleton states — just text "Loading..." placeholders
- No error boundaries for API failure toast notifications

---

## 10. Testing

**Coverage by module:**

| Module | Test Files | Coverage Level |
|--------|-----------|---------------|
| source/domain (ncode) | `ncode.test.ts` | Excellent — 12 cases |
| source/infra (syosetu-api) | `syosetu-api.test.ts` | Good — 4 cases, mocked fetch |
| source/infra (episode-scraper) | `episode-scraper.test.ts` | Excellent — 10 cases, real HTML fixtures |
| catalog/api | `schemas.test.ts` | Minimal — 1 case |
| translation/api | `schemas.test.ts` | Good — 4 cases |
| reader/api | `schemas.test.ts` | Minimal — 1 case |
| identity/api | `schemas.test.ts` | Good — 3 cases |
| reader/components | `compare-pane.test.ts` | Exists (as noted in glob) |

**Issues:**

- **No tests for application layer** — `request-translation.ts`, `translation-sessions.ts`, `quality-validation.ts`, `chunk-episode.ts`, `glossary-entries.ts`, `extract-glossary.ts` — all untested
- No DB integration tests (Drizzle queries in application code)
- Browser test (`tests/browser/smoke.spec.ts`) exists but coverage is unknown
- `quality-validation.ts` is a pure function with no side effects — ideal candidate for unit tests but untested
- No test for `compare-pane.tsx`'s `buildRows` alignment function despite it being exported specifically for testing
- No test for `splitIntoChunks` or `splitSourceInHalf` logic
- `ncode.test.ts` relies on `@/` alias resolution — works with vitest config but worth noting

---

## 11. Cross-cutting Concerns

### Error Handling

- **Good:** `apiError()` suppresses 500-level details in production
- **Good:** Non-fatal failures (glossary extraction after translation, title translation after ingest) are caught and logged
- **Issue:** `processQueuedTranslation()` at line 603 catches everything — but the catch block reads from DB (line 606-617), which could also fail in the error handler itself
- **Issue:** Numerous `catch {}` (empty catch blocks) — line 124 in `job-handlers.ts`, line 33 in `pubsub.ts`, line 46 in `events/route.ts` — silently swallowing errors is an anti-pattern

### Logging

- **Good:** Structured JSON logging with consistent `{ message, meta }` pattern
- **Issue:** `logger` is a simple wrapper around `console.log` — no log levels filtering, no log rotation, no transport abstraction
- **Issue:** `console.error` at line 174 in `extract-glossary.ts` should use `logger.warn` for consistency
- **Issue:** No correlation ID across job lifecycle — tracing a single translation from request → queue → processing → completion requires manual log correlation

### Rate Limiting

- **Good:** Dual-mode implementation (Redis + in-memory fallback)
- **Good:** Proper `Retry-After` and `X-RateLimit-*` headers
- **Issue:** In-memory rate limiter has no per-IP isolation on serverless — all requests from any IP share the same in-memory bucket per process
- **Issue:** Redis rate limiter uses `INCR` + `EXPIRE` — not atomic in race conditions (two concurrent `INCR` returning 1 would both set `EXPIRE`, window reset is safe but count could exceed limit)

### Observability

- **Good:** `ops-metrics.ts` with Redis hash counters and memory fallback
- **Good:** OpenRouter usage tracking (tokens, cost) per operation
- **Issue:** Metrics use `hIncrByFloat` with 30-day TTL — fine for counters but no histogram support for latency
- **Issue:** No health check endpoint (`/api/health`) for Docker orchestration
- **Issue:** No structured error classification — all OpenRouter errors are bucketed by `operation` + `status` but not by error type (auth, rate-limit, timeout, model-not-found)

---

## 12. Security Observations

- **Issue:** `SSE` endpoint (`events/route.ts`) has no authentication — anyone with an episodeId UUID can subscribe
- **Issue:** `OPENROUTER_API_KEY` is passed to the client-side `provider.translate()` call — verify it's never exposed to the browser (it appears server-only in `processQueuedTranslation`, but worth auditing all code paths)
- **Good:** `docker-entrypoint.sh` runs migrations before starting Next.js — consistent with production security posture
- **Issue:** `Dockerfile` copies `src/` and `scripts/` into production image — source files aren't needed at runtime and could leak business logic
- **Good:** Production error responses suppress internal details via `apiError()`

---

## 13. Performance Observations

- `getTranslationStatus()` is called on SSE connection (initial snapshot) and likely on every page load — each call hits the DB multiple times
- `loadTranslationContext()` (in `request-translation.ts`) makes 3 sequential DB queries (settings, glossaries, glossary entries) — could be parallelized with `Promise.all`
- Batch title translation in `handleIngestAll` calls `translateTexts(titles)` — no limit on title count, a novel with 1000 episodes would send 1000 titles in one LLM call
- `importGlossaryEntries` does individual `SELECT` per entry before insert — O(n) queries for n entries. Could batch-check with `WHERE termJa IN (...)` and `WHERE category IN (...)`
- No Redis connection pooling configuration evident — every call to `getRedisClient()` potentially creates a new connection

---

## 14. Code Quality Summary

| Metric | Assessment |
|--------|-----------|
| **Modularity** | Excellent — clear module boundaries |
| **Testability** | Needs improvement — application layer untested |
| **Error handling** | Mixed — good patterns but empty catch blocks |
| **Type safety** | Strong — full TypeScript strict mode, Zod everywhere |
| **Documentation** | Good — JSDoc on key functions, architecture docs |
| **Consistency** | Good — naming conventions mostly uniform |
| **Performance** | Fair — N+1 queries, no caching layer |
| **Security** | Needs review — unauthenticated SSE endpoint |

---

## 15. Recommendations (Priority-Ordered)

1. **P0 — Empty catch blocks** — Audit and replace `catch {}` with at minimum a `logger.warn()` for traceability
2. **P0 — SSE auth** — Add authentication check to `events/route.ts`
3. **P1 — Test application layer** — Start with `quality-validation.ts` (pure function, no mocks needed), then `chunk-episode.ts`, then `glossary-entries.ts`
4. **P1 — Split overlong files** — `request-translation.ts` → extract truncation recovery to `chunk-episode.ts`; `novel-glossary-editor.tsx` → split into component composition
5. **P1 — N+1 query in `importGlossaryEntries`** — Batch the existence check with `IN` clause
6. **P2 — Parallelize `loadTranslationContext`** — Use `Promise.all` for the three independent DB queries
7. **P2 — Configurable constants** — Extract `MAX_SPLIT_DEPTH`, `CHUNK_THRESHOLD`, `TARGET_CHUNK_SIZE` into env or config
8. **P2 — Health endpoint** — Add `GET /api/health` for Docker orchestration readiness probes
9. **P2 — Correlation ID** — Add a tracing header through the job lifecycle
10. **P3 — Remove source from production image** — Update Dockerfile to not copy `src/` and `scripts/` into runtime image
11. **P3 — Redis connection pooling** — Configure reusable connection pool instead of per-call connections
12. **P3 — CSRF protection** — Add to auth endpoints before the application grows larger
