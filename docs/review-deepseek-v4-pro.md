# Code Review: Shosetu Reader (deepseek-v4-pro)

> Review date: 2026-04-24
> Scope: Full-stack Next.js 16 + Drizzle ORM + OpenRouter translation pipeline
> Previous reviews: [deepseek-v4-flash](./review-deepseek-v4-flash.md), [V3 review](./v3-review.md)

---

## 1. Executive Summary

The codebase demonstrates solid architectural discipline with a 10-module modular monolith, comprehensive Zod validation, and a well-designed async translation pipeline. 74 tests pass with 0 failures. However, this review surfaces **12 high-severity issues** and **29 medium-severity issues** spanning race conditions, missing application-layer tests, N+1 queries, and inconsistent error logging. Compared to the prior `deepseek-v4-flash` review, several recommendations remain unaddressed — notably the empty `catch {}` blocks, SSE auth gap, and missing application-layer tests.

---

## 2. Architecture Overview

### Strengths

- **4-layer modular monolith** (`domain/` → `application/` → `infra/` → `api/`) consistently applied across 10 modules
- **Zod validation** at every boundary: env vars (`src/lib/env.ts`), API input, API output, DB schemas
- **Clean API route pattern**: thin route handlers that delegate to application-layer services, with `apiError()` suppressing internals in production
- **Dual job queue** (Redis + in-memory fallback) with stale job recovery and exponential backoff
- **SSE endpoint** (`translations/episodes/[id]/events`) with Redis pub/sub, heartbeat, and proper cleanup
- **Request deduplication** with 10s TTL guards against double-submission on ingest/translate operations
- **Strong security headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options, etc.
- **Type-safe i18n** with cookie-based locale persistence; `as const` dictionary infers all keys

### Weaknesses

- **Pervasive 4-layer boundary violation**: 10 application-layer files contain inline Drizzle queries instead of delegating to `infra/`. The pattern started early and became convention — the application and infra layers are effectively merged.
- **`request-translation.ts`** (638 lines) and **`translation-sessions.ts`** (519 lines) exceed the ~200-line guideline in `AGENTS.md`
- **`glossary-entries.ts`** (293 lines) mixes CRUD, eviction, and version-bumping in one file
- **`novel-glossary-editor.tsx`** (~570 lines) is a monolith component doing data fetching, form state, polling, model picking, and rendering
- **`admin` module is entirely empty** — admin API routes bypass the module and embed DB queries directly
- **`events` and `export` modules** have only a single `application/` file each — missing domain, infra, and api layers
- **`src/features/`, `src/styles/`, `src/lib/cache/`, `src/lib/queue/`** contain only `.gitkeep` — dead directories
- **`AGENTS.md` claims V3 is "planned"** but the codebase already has full V3 implementation (sessions, structured glossary, quality validation, chunking)

---

## 3. File-by-File Findings

### 3.1 Translation Module (`src/modules/translation/`)

#### `infra/openrouter-provider.ts` (206 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T1 | **HIGH** | 33 | Default model hardcoded to `"deepseek/deepseek-v4-flash"` — bypasses `env.OPENROUTER_DEFAULT_MODEL`. If the env var changes, code still uses the hardcoded default. |
| T2 | **MEDIUM** | 118,139,141,157 | Hardcoded API URL `"https://openrouter.ai/api/v1/chat/completions"` repeated across 4+ files. No shared HTTP client abstraction. |
| T3 | **MEDIUM** | 120,141 | Hardcoded timeout `AbortSignal.timeout(180_000)` — different models need different timeouts |
| T4 | **MEDIUM** | 130 | `temperature: 0.3` hardcoded, not configurable |
| T5 | **MEDIUM** | 176-180 | Truncation retry exhausted but outer loop continues — when `MAX_TRUNCATION_RETRIES` (2) is reached, the outer `MAX_RETRIES` (3) loop still iterates without meaningfully changing `currentMaxTokens`, wasting retry attempts |
| T6 | **MEDIUM** | 139-141 | No jitter in exponential backoff — pure `Math.pow(2, attempt) * 1000`. With multiple workers hitting rate limits, thundering-herd possible. |
| T7 | **MEDIUM** | 136-141 | `recordOpenRouterError()` called without `await` — unhandled promise rejection if it throws |
| T8 | **MEDIUM** | 59,67 | `messages: Array<Record<string, unknown>>` loses type safety for OpenRouter message format |
| T9 | **MEDIUM** | 107-111 | Adaptive max_tokens formula uses magic numbers: `(sourceChars * 1.5) / 1.2 + 1024` — Korean tokenization averages ~2 chars/token, but formula assumes ~3 |
| T10 | **LOW** | 166 | No `typeof content === "string"` check before using `content.trim()` — if model returns non-text, throws TypeError |

#### `application/request-translation.ts` (638 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T11 | **HIGH** | 162-178 | Race condition: when an existing failed translation is found, it's reset to `"queued"`, then the job is enqueued. Between the UPDATE and the enqueue, another worker could pick up and process it — if the queue has no dedup, the same translation could run twice. |
| T12 | **HIGH** | 383-392,547-567 | No heartbeat/timeout for stuck "processing" translations — if the process crashes during translation, the row stays "processing" forever. `estimate-translation-progress.ts` attempts progress for in-flight work but there's no recovery mechanism. |
| T13 | **HIGH** | 396-501 | No partial success — if main body translation succeeds but preface/afterword translation fails, the valid body translation is discarded entirely |
| T14 | **MEDIUM** | 298-353 | Recursive truncation recovery (`translateWithTruncationRecovery`) could generate up to 15 API calls for a single chunk at max depth (2^3 = 8 calls). No cost guard. |
| T15 | **MEDIUM** | 517-529 | Re-queries glossary entries for quality validation despite the entries already being passed in the job payload's `glossary` field — duplicate DB query |
| T16 | **MEDIUM** | 579-594 | N+1 re-query of episode for `episodeNumber` — the episode was already fetched at line 108-112. Should pass `episodeNumber` in the job payload. |
| T17 | **MEDIUM** | 420-425 | When any chunk doesn't report token info, `hasTokenInfo` becomes `false` for the entire operation — loses valid token data from chunks that did report. |
| T18 | **MEDIUM** | 182,355 | `ownerUserId` is set in the job payload but `processQueuedTranslation` never reads it — dead data. |
| T19 | **LOW** | 18 | `PROMPT_VERSION = "v2"` hardcoded — sessions use `"v3"` in `translation-sessions.ts`. If migration to "v4" is needed, must change in 2+ places. |
| T20 | **LOW** | 268 | `text.length < 200` split threshold hardcoded |

#### `application/glossary-entries.ts` (293 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T21 | **HIGH** | 270-293 | Race condition in `bumpGlossaryVersion`: SELECT-then-UPDATE-or-INSERT without atomicity. Two concurrent calls can both see the same state and produce lost updates or duplicate inserts. Should use `INSERT ... ON CONFLICT DO UPDATE`. |
| T22 | **HIGH** | 151-258 | `importGlossaryEntries` does N+1 queries: for 30 entries, it performs ~120 individual queries (SELECT per entry, UPDATE/INSERT, COUNT, potential eviction DELETE). Should batch with `WHERE termJa IN (...)` and use upserts. |
| T23 | **MEDIUM** | 218-240 | Eviction logic is race-prone: COUNT → DELETE without a transaction or row-level lock. Concurrent imports could push count above `MAX_CONFIRMED_ENTRIES` or evict the same row twice. |
| T24 | **MEDIUM** | 113-118 | `updateGlossaryEntry` bumps version on ANY confirmed entry edit, including trivial field changes (e.g., `notes`) — invalidates cached translation prompts unnecessarily |
| T25 | **MEDIUM** | 139 | `MAX_CONFIRMED_ENTRIES = 50` hardcoded |
| T26 | **LOW** | 262-263 | Confusing condition: `entries.some((e) => e.status === "confirmed")` is redundant if `confirmedChanged` is true |

#### `application/translation-sessions.ts` (519 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T27 | **HIGH** | 282 | `ownerUserId` set to empty string `""` — no user context. Unlike `request-translation.ts:182` where `ownerUserId: ctx.userId` is properly set. Data integrity issue. |
| T28 | **HIGH** | 163-170 | Ordering guard (`expectedNextIndex`) silently returns on mismatch — no re-enqueue, no session resume mechanism. A single out-of-order advance permanently stalls the session. |
| T29 | **MEDIUM** | 149,476-485 | Budget check reads `totalCostUsd` but concurrent update uses server-side `sql` arithmetic — the read value is stale by the time the budget check runs. Could exceed budget. |
| T30 | **MEDIUM** | 308-325 | Failure policy: continues translation on next episode but never resets the failed translation status — orphaned "processing" row (also noted in V3 review A2) |
| T31 | **MEDIUM** | 351-497 | `generateSessionSummary` has no idempotency guard — if the job is enqueued twice, duplicate summaries and double-incremented cost |
| T32 | **LOW** | 453 vs 416 | Summary is sliced to 2500 chars at storage but prompt asks model for "under 2000" — inconsistency |
| T33 | **LOW** | 418 | `resolveModel("summary")` uses a separate model config — undocumented in `.env.example` |

#### `application/generate-glossary.ts` (373 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T34 | **MEDIUM** | 120-127 | Large context assembly in memory — 10 episodes × 3K chars each = ~60K chars. No validation that total fits within the model's context window. |
| T35 | **MEDIUM** | 232-247 | Term deduplication uses only `termJa` — if same term appears in different categories (character vs place name), the second entry is incorrectly suppressed |
| T36 | **LOW** | 139,141,157,158,119 | Hardcoded API URL, timeout, temperature, `response_format`, `max_tokens` — same pattern as `openrouter-provider.ts`. No shared HTTP abstraction. |
| T37 | **LOW** | — | No retry logic — unlike `openrouter-provider.ts` with 3 retries, a single API failure fails the entire generation |

#### `application/extract-glossary.ts` (210 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T38 | **MEDIUM** | 97-98 | Hard truncation at 4000 chars without respect for word/sentence boundaries — can cut mid-word, producing garbled LLM input |
| T39 | **MEDIUM** | 174,180 | Uses `console.error` instead of project `logger.error` |
| T40 | **MEDIUM** | 168-183 | JSON parsing fallback uses greedy regex `/\[[\s\S]*\]/` — can match across multiple JSON arrays if response contains extra content |
| T41 | **LOW** | 100-122 | Duplicate API call pattern — same URL, headers, structure as other files. No shared client. |
| T42 | **LOW** | 101 | Shorter timeout (120s) than other translation operations (180s) — inconsistent |

#### `application/refresh-glossary.ts` (127 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T43 | **HIGH** | 106-108 | Errors silently swallowed: `catch { skipped += 1; }` — no logging, no retry, no error aggregation. Caller has no way to know extractions failed. |
| T44 | **HIGH** | 111-114 | `glossaryLastRefreshedAt` updated unconditionally even when zero extractions succeed — prevents re-extraction when API becomes available again |
| T45 | **MEDIUM** | 91 | Sequential extraction in `for...of` loop — 20 sequential API calls for 20 episodes. Should parallelize with a concurrency limit. |

#### `application/quality-warnings-aggregation.ts` (194 lines)

| # | Severity | Line | Issue |
|---|----------|------|-------|
| T46 | **MEDIUM** | 74 | Fetches ALL matching rows into memory with no LIMIT — could be thousands for a large novel |
| T47 | **MEDIUM** | 149-164 | Pagination broken by JS-side code/severity filtering — rows whose warnings are filtered out don't count toward the page limit, making pages sparse |
| T48 | **MEDIUM** | 116-171 | `listWarnings` fetches rows then filters in JS — SQL-side filtering would be more efficient |

#### Other Translation Module Files

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| T49 | **MEDIUM** | `cost-estimation.ts` | — | Thin passthrough wrapper — could be inlined. No error handling if `getOpenRouterModelPricing` throws. |
| T50 | **MEDIUM** | `discard-translations.ts` | 42-64 | Two-query pattern: SELECT all episode IDs, then DELETE. For thousands of episodes, a subquery would be more efficient. No authorization check. |
| T51 | **MEDIUM** | `estimate-translation-progress.ts` | 31 | Sequential queries: model-specific samples, then cross-model fallback. Could be parallelized with `Promise.all`. |
| T52 | **MEDIUM** | `render-glossary-prompt.ts` | 34-41 | Re-sorts entries on every call — should sort at storage time or cache. Category order array `["character","place","term","skill","honorific"]` duplicated across files. |
| T53 | **LOW** | `render-glossary-prompt.ts` | 15 | `escapePipe` doesn't handle trailing whitespace before pipe — markdown table could break |
| T54 | **LOW** | `prompt-fingerprint.ts` | — | `crypto.createHash` is synchronous/CPU-bound — fine for small inputs but could block event loop for a very large `styleGuide` |
| T55 | **MEDIUM** | `quality-validation.ts` | 56-58 | Japanese character detection regex `[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]` overlaps with Korean Hanja (Chinese characters) — false positives for Korean text using Hanja |
| T56 | **MEDIUM** | `quality-validation.ts` | 82-90 | Truncation detection uses `/[다요죠임음됨함.\!\?]/` on last 50 chars — false positives when mid-text contains these characters. `\!` in character class is unnecessary. |
| T57 | **LOW** | `quality-validation.ts` | 41-114 | All thresholds hardcoded (0.5, 2.0, 10, 50, 0.7, 1.5, 100, 20) |
| T58 | **LOW** | `domain/default-prompt.ts` | — | Prompt is a static string constant — no version identifier. Changes won't invalidate cached translations produced with old prompts. |
| T59 | **LOW** | `chunk-episode.ts` | 101-103 | `overlapSourceTail` is populated on each chunk but never read by the calling code — dead field |

### 3.2 Identity Module (`src/modules/identity/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| I1 | **HIGH** | `session-auth.ts` | 79-104 | Race condition: `signInWithEmail` does SELECT for existing user, then INSERT if not found — no `onConflictDoNothing`. Two concurrent sign-ins with same email will cause a unique constraint violation crash. |
| I2 | **HIGH** | `guest-profile-migration.ts` | 150-188 | N+1 queries: for-loop over `guestProgressRows` does SELECT + INSERT/UPDATE + DELETE per row. For 50 novels in progress, ~150 individual queries in one transaction. Should batch with `inArray`. |
| I3 | **MEDIUM** | `profiles.ts` | 74-88 | `createProfile`: INSERT user row, THEN call `migrateGuestStateToProfile`. If migration fails, zombie profile exists. Should share a transaction or insert after migration. |
| I4 | **MEDIUM** | `session-auth.ts` | — | No rate limiting on sign-in — attacker could fill `userSessions` table |
| I5 | **MEDIUM** | `session-auth.ts` | — | No CSRF protection on sign-in/sign-out |
| I6 | **MEDIUM** | `guest-profile-migration.ts` | 63 | `isNewProfile` boolean determined BEFORE transaction — could be stale if two concurrent profile creations race |
| I7 | **MEDIUM** | `profiles.ts` | 118 | Uses generic `throw new Error("Profile not found")` — no structured error type, callers can't distinguish error cases |
| I8 | **LOW** | `session-auth.ts` | — | No TTL cleanup for expired sessions — unbounded table growth |
| I9 | **LOW** | `infra/session-cookie.ts` | 4 | `SESSION_TTL_DAYS = 30` hardcoded |
| I10 | **LOW** | `profiles.ts` | 60 | Cookie name `"locale"` hardcoded as string literal — should use a shared constant |

### 3.3 Library Module (`src/modules/library/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| L1 | **HIGH** | `get-reading-stats.ts` | 154 | `SUM(DISTINCT {estimatedCostUsd})` is incorrect: if two translations share the same cost (e.g., both $0.01), only one is counted. Should restructure the join to avoid duplication, not `SUM(DISTINCT cost)`. |
| L2 | **HIGH** | `update-progress.ts` | 29-62 | Race condition in progress upsert: SELECT-then-UPDATE-or-INSERT without `onConflictDoUpdate`. Two concurrent requests for same `(userId, novelId)` cause unique constraint violation on INSERT. |
| L3 | **HIGH** | `update-progress.ts` | 74-87 | Race condition in event dedup: SELECT then INSERT without `onConflictDoNothing`. Two concurrent requests within 60s both pass the check and create duplicate events. |
| L4 | **HIGH** | `subscribe.ts` | 21 | **Design concern**: "Subscriptions are universal (not per-user)" — any user can subscribe/unsubscribe for all users. Confirmed in 3 places (`subscribe.ts:21`, `get-library.ts:16`, `guest-profile-migration.ts:143`). If intentional for a shared library, should be documented. Otherwise, a critical authorization gap. |
| L5 | **MEDIUM** | `subscribe.ts` | 22-42 | Race condition: SELECT for existing subscription, then INSERT if not found |

### 3.4 Jobs Module (`src/modules/jobs/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| J1 | **HIGH** | `job-runs.ts` | 235-242 | Type-unsafe payload access: `(payload as Record<string, unknown>).ownerUserId` — if payload JSONB is malformed, returns `null` silently. At call site (line 155), this means `getLatestNovelJobForUser` returns `null` (no job found), potentially allowing duplicate job submissions. |
| J2 | **HIGH** | `job-handlers.ts` | 52-63 | `jobHandlers` map casts every handler `as JobHandler<unknown>`, losing all type safety. No compile-time guarantee that the payload shape matches the handler's expectations. |
| J3 | **HIGH** | `job-runtime.ts` | 180-192 | Race condition in `moveDelayedJobsToPending`: `ZRANGEBYSCORE` → `ZREM` → `RPUSH` — three non-atomic Redis commands. With multiple workers, two could both read the same delayed job and push it twice. Should use Lua script or `ZPOPMIN`. |
| J4 | **MEDIUM** | `inline-job-queue.ts` | 49-51 | `setTimeout(() => { void this.run(job); }, 0)` — the `void` discards the promise. If `run()` throws synchronously, error silently swallowed. If asynchronously, unhandled promise rejection. |
| J5 | **MEDIUM** | `inline-job-queue.ts` | — | No retry for inline jobs — permanently failed on first error. Unlike Redis worker which has `requeueJob`. |
| J6 | **MEDIUM** | `job-runtime.ts` | 195-205 | `reconcileQueuedJobs` pushes jobs to Redis without checking if already pending — causes duplicate entries in pending list |
| J7 | **LOW** | `job-runtime.ts` | 59-64 | SIGINT/SIGTERM handlers don't await in-flight jobs — process could terminate mid-job |

### 3.5 Source Module (`src/modules/source/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| S1 | **MEDIUM** | `episode-scraper.ts` | 40-61 | `fetchEpisodeList` follows pagination via `while(true)` — no upper bound. For 10,000+ episode novel, makes 100+ sequential HTTP requests with no rate limiting between pages. |
| S2 | **MEDIUM** | `syosetu-api.ts` | 91 | Assumes first array element is always `{ allcount: N }` — fragile to API response format changes |
| S3 | **LOW** | `syosetu-api.ts` | 150-167 | `fetchRanking` silently skips malformed results with no logging |
| S4 | **LOW** | `syosetu-api.ts` | 78,132 | `User-Agent: "ShosetuReader/0.1"` — hardcoded, outdated |
| S5 | **LOW** | `syosetu-api.ts` | 67,118 | Duplicate fetch logic in `fetchNovelMetadata` and `fetchRanking` |
| S6 | **LOW** | `episode-scraper.ts` | 186 | `checksum.slice(0, 16)` — truncates SHA-256 to 64 bits. Acceptable for content dedup but increases collision probability. |

### 3.6 Catalog Module (`src/modules/catalog/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| C1 | **HIGH** | `ingest-episodes.ts` | 29-53 | N+1 query: `discoverEpisodes` does one SELECT per TOC entry to check existence. For 500+ episode novels, 500 individual queries. Should batch with `WHERE sourceEpisodeId IN (...)`. |
| C2 | **MEDIUM** | `register-novel.ts` | 35-115 | `upsertNovel` uses SELECT-then-UPDATE-or-INSERT without `onConflictDoUpdate` — concurrent registrations of same ncode cause unique violation crash |
| C3 | **MEDIUM** | `get-ranking.ts` | 62-93 | Same SELECT-then-INSERT race as `register-novel.ts` |
| C4 | **MEDIUM** | `translate-novel-metadata.ts` | 32 | Returns early if `titleKo` exists — but `summaryKo` might still be untranslated. Only title is checked. |
| C5 | **MEDIUM** | `translate-novel-metadata.ts` | 86-87 | JSON parsing from LLM uses fragile `regex.replace()` — no robust JSON extraction if model adds extra text |
| C6 | **MEDIUM** | `ingest-episodes.ts` | 103-106 | Episode marked "fetching" BEFORE actual fetch — if process crashes, episode stuck in "fetching" forever. No staleness recovery. |
| C7 | **MEDIUM** | `refresh-metadata.ts` | 43-99 | Sequential iteration over subscribed novels with 1s delay — for hundreds of subscriptions, takes minutes. No parallel processing. |

### 3.7 API Routes (`src/app/api/`)

| # | Severity | File | Issue |
|---|----------|------|-------|
| R1 | **HIGH** | `bulk-translate-all/route.ts` | 58-86 | Race condition: session-existence check happens BEFORE dedupe lock. Two concurrent requests can both see no active session, then both create one. Also noted in V3 review A3. |
| R2 | **MEDIUM** | 12+ route files | Inconsistent error logging: 12+ routes use `console.error()` directly instead of `logger.error()`. Routes that do use logger: `admin/*`, `jobs/*`, `openrouter/models`, `translation-settings`. Affected: `auth/sign-in`, `novels/*` (register, ingest, reingest-all, live-status), `library/*`, `reader/*`, `translations/*`, `settings`, `progress`, `ranking/*`, `stats`, `admin/translations/*`, `glossary/*`. |
| R3 | **MEDIUM** | `novels/[novelId]/episodes/route.ts` | 14 | Redundant DB lookup: calls `getNovelById` (to check 404), then `getEpisodesByNovelId` which also queries the novel internally — doubles the query count |
| R4 | **MEDIUM** | `bulk-translate/route.ts` | 71-78 | Sequential `requestTranslation` in for-loop — if 50 episodes and each takes 200ms, client could time out. Should parallelize with `Promise.allSettled`. |
| R5 | **MEDIUM** | `export/route.ts` | 63-64 | Error message from `buildEpub` returned directly to client in production — leaks internal error details. Should use `apiError()`. |
| R6 | **MEDIUM** | `jobs/[jobId]/route.ts` | 42-68 | `sanitizeJobResult` has hardcoded field whitelist — fragile to new job types adding fields |
| R7 | **MEDIUM** | `glossary/route.ts` | 77 | Manual type check `typeof body.glossary === "string"` instead of Zod schema — if client sends `{ glossary: 123 }`, silently becomes empty string |
| R8 | **MEDIUM** | `glossary/entries/route.ts` | 31-37 | Manual validation with hardcoded category array — duplicates enums. Should use Zod. |
| R9 | **MEDIUM** | `glossary/entries/[entryId]/route.ts` | 16 | Passes raw parsed JSON body directly to application layer — no request body validation |
| R10 | **MEDIUM** | `settings/route.ts` | 53-55 | Manual validation of `locale`, `readerLanguage`, `theme` with hardcoded string checks — inconsistent with Zod-only routes |
| R11 | **MEDIUM** | `translations/episodes/[episodeId]/request/route.ts` | 36 | Returns status 400 for all errors including server-side failures — should return 500 for server errors |
| R12 | **LOW** | Several routes | `ownerUserId: "site"` hardcoded string used instead of a named constant |

### 3.8 Infrastructure (`src/lib/`)

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| X1 | **HIGH** | `rate-limit.ts` | 146-157 | `getClientIp` takes the **last** IP from `x-forwarded-for` — in standard proxy setups, the first (leftmost) IP is the original client. Rate limiting applies to the proxy IP, not the actual client. Should use `parts[0].trim()`. |
| X2 | **MEDIUM** | `rate-limit.ts` | 157 | Fallback IP `"unknown"` buckets all unidentified clients into one rate limit pool — could cause one client consuming all requests for everyone behind Cloudflare |
| X3 | **MEDIUM** | `redis/client.ts` | 19-21 | Redis error handler is a no-op `() => {}` — all Redis errors silently swallowed with no observability |
| X4 | **MEDIUM** | `translate-cache.ts` | 84 | `"HTTP-Referer"` header is non-standard — HTTP spec is `Referer` (single 'r') or `Referrer-Policy`. OpenRouter may reject. |
| X5 | **MEDIUM** | `translate-cache.ts` | 135-139 | Fragile numbered-list parsing from LLM output: regex `^(\d+)\.\s*(.+)` fails if LLM uses different numbering. Should have fallback line-by-line mapping. |
| X6 | **MEDIUM** | `openrouter/models-cache.ts` | 213-216 | `getOpenRouterModelPricing` fetches ALL models for a single lookup — wasteful if called in hot paths |
| X7 | **MEDIUM** | `i18n/index.ts` | 33 | `String.replace()` without global flag — only first occurrence of each placeholder replaced. Template like `"{name} and {name}"` would be incorrect. Should use `replaceAll`. |
| X8 | **MEDIUM** | `i18n/client.ts` | 22 | Same `.replace()` without global flag as server i18n |
| X9 | **MEDIUM** | `request-dedupe.ts` | 24-46,77-98 | Code duplication: Redis and memory lock paths are structurally identical |
| X10 | **MEDIUM** | `auth/default-user.ts` | 18-36 | `ensureDefaultUser` uses SELECT-then-INSERT without `onConflictDoNothing` — race condition on first use |
| X11 | **LOW** | `ops-metrics.ts` | 44,61,64 | Every `incrementMetric` also calls `redis.expire()` — wasteful when increments happen frequently |
| X12 | **LOW** | `validation.ts` | 1 | `UUID_RE` uses case-insensitive `/i` — Postgres stores UUIDs lowercase. Mixed-case could cause mismatch. |
| X13 | **LOW** | `env.ts` | 43 | `OPENROUTER_EXTRACTION_MODEL` typo — "EXTRACTION" missing the letter 'C'. Appears consistently throughout codebase (intentional naming?). |

### 3.9 Testing

| # | Severity | Issue |
|---|----------|-------|
| Q1 | **HIGH** | **Zero application-layer tests** for the most complex modules. Untested: `request-translation.ts` (638 lines), `translation-sessions.ts` (519 lines), `quality-validation.ts` (128 lines, pure functions!), `chunk-episode.ts` (112 lines, pure functions!), `glossary-entries.ts` (293 lines), `extract-glossary.ts`, `generate-glossary.ts`, `prompt-fingerprint.ts`, `render-glossary-prompt.ts`. |
| Q2 | **MEDIUM** | Test distribution is heavily skewed toward schema validation (9 of 14 test files). Only 2 infrastructure tests and 1 domain test. |
| Q3 | **MEDIUM** | No DB integration tests — all Drizzle queries in application code are untested against a real database. |
| Q4 | **MEDIUM** | Only 1 browser E2E smoke test (`tests/browser/smoke.spec.ts`) — no Playwright coverage for critical user flows (register novel, read episode, translate, subscribe). |
| Q5 | **LOW** | `ncode.test.ts` (86 lines, 12 test cases) — good coverage on source domain. `episode-scraper.test.ts` (177 lines, 10 cases) — excellent with real HTML fixtures. Best examples in the test suite. |
| Q6 | **LOW** | Schema tests only test success cases — missing edge cases: missing required fields, wrong types, boundary values, invalid UUIDs, max lengths |

---

## 4. Cross-Cutting Issues

### 4.1 Race Condition Pattern (Systemic)

The **"SELECT-then-INSERT" anti-pattern** appears in **9 distinct locations**:

1. `session-auth.ts:79-104` — sign-in user creation
2. `update-progress.ts:29-62` — reading progress upsert
3. `update-progress.ts:74-87` — reading event deduplication
4. `subscribe.ts:22-42` — subscription creation
5. `guest-profile-migration.ts:87-115` — reader preferences migration
6. `guest-profile-migration.ts:117-141` — translation settings migration
7. `register-novel.ts:35-115` — novel upsert
8. `get-ranking.ts:62-93` — ranking registration
9. `default-user.ts:18-36` — default user creation

**Fix pattern**: Use PostgreSQL `ON CONFLICT DO UPDATE` (upsert) or `ON CONFLICT DO NOTHING` instead of application-level check-then-act.

### 4.2 4-Layer Boundary Violation

10 application-layer files contain inline Drizzle queries, violating the stated architecture:
- `identity/application/`: 4 files
- `library/application/`: 4 files
- `jobs/application/job-runs.ts`
- `reader/application/get-reader-payload.ts`

The convention drifted — application and infra layers are effectively merged.

### 4.3 Error Logging Inconsistency

- **12+ API routes** use `console.error()` directly
- **~6 routes** use `logger.error()`
- `extract-glossary.ts:174,180` uses `console.error` instead of logger
- `api-error.ts:18` uses `console.error` instead of logger
- No correlation ID across the job lifecycle for tracing

### 4.4 Empty Catch Blocks

- `job-handlers.ts:124` — empty `catch {}`
- `pubsub.ts:33,46` — empty error handlers
- `register-novel.ts:66,100` — `.catch(() => {})` on fire-and-forget translations
- `refresh-glossary.ts:106-108` — `catch { skipped += 1; }` with no logging

### 4.5 No Structured Error Types

All error handling uses `throw new Error("...")` with string messages. No custom error classes (e.g., `NovelNotFoundError`, `ProfileNotFoundError`). Callers cannot programmatically distinguish error types.

### 4.6 Missing Authorization Checks

- **SSE endpoint** (`events/route.ts`) has no authentication — anyone with an episodeId UUID can subscribe
- **Admin routes** are the only routes with `requireAdmin()` checks
- **Subscriptions** are intentionally universal (not per-user) — design decision should be documented
- **`discard-translations.ts`** has no caller authorization check

### 4.7 Dead Code

- `src/features/`, `src/styles/`, `src/lib/cache/`, `src/lib/queue/` — only `.gitkeep`
- `admin` module entirely empty (all 4 layers)
- `events` module has only `application/publish-event.ts`
- `export` module has only `application/build-epub.ts`
- `chunk-episode.ts:101-103` — `overlapSourceTail` populated but never read
- `request-translation.ts:45,182` — `ownerUserId` set but `processQueuedTranslation` never reads it
- `reader/api/schemas.ts:27` — `hasWarnings` field added to reader payload but frontend never renders it

---

## 5. Database Schema Issues

| # | Severity | Issue |
|---|----------|-------|
| D1 | **MEDIUM** | `translations` table has no index on `sessionId` — session queries would sequential scan |
| D2 | **MEDIUM** | `translationSettings.favoriteModels` uses PostgreSQL array type — less portable, no index on array elements |
| D3 | **LOW** | `episodes.rawHtmlChecksum` is `text` — a fixed-length type would be more appropriate for SHA-256 truncated to 16 chars |
| D4 | **LOW** | No index on `episodes.sourceEpisodeId` alone (only composite with `novelId`) — standalone lookups would scan |
| D5 | **LOW** | `readerPreferences` table exists in DB but reader font settings are also stored in cookies (`reader-prefs`) — dual source of truth |

---

## 6. Security Observations

### Issues

| # | Severity | Issue |
|---|----------|-------|
| SE1 | **HIGH** | SSE endpoint (`events/route.ts`) has no authentication — also noted in prior flash review (unresolved) |
| SE2 | **MEDIUM** | Sign-in has no rate limiting — attacker can fill `userSessions` table |
| SE3 | **MEDIUM** | No CSRF protection on sign-in/sign-out endpoints |
| SE4 | **MEDIUM** | `Dockerfile` copies `src/` and `scripts/` into production image — source files expose business logic |
| SE5 | **MEDIUM** | Admin routes in development mode allow all requests without API key if `ADMIN_API_KEY` is not configured |
| SE6 | **LOW** | `export/route.ts:63-64` — internal error details leaked to client in production (should use `apiError()`) |

### Strengths

- Strong CSP, HSTS, X-Frame-Options headers in `next.config.ts`
- `poweredByHeader: false` — no framework version leak
- `apiError()` suppresses internal details in production
- No SQL injection — Drizzle ORM parameterizes all queries, raw SQL uses template tag
- No XSS — API returns JSON, client handles rendering
- No secrets exposed — all keys from Zod-validated `env.ts`
- `timingSafeEqual` used for admin API key comparison
- `sameSite: "lax"`, `httpOnly`, `secure` (production) on session cookies

---

## 7. Performance Observations

| # | Severity | Issue |
|---|----------|-------|
| P1 | **HIGH** | `ingest-episodes.ts:29-53` — N+1 query per TOC entry (500+ queries for large novels) |
| P2 | **HIGH** | `glossary-entries.ts:151-258` — N+1 per entry import (~120 queries for 30 entries) |
| P3 | **MEDIUM** | `loadTranslationContext()` in `request-translation.ts` — 3 sequential DB queries, could be `Promise.all` |
| P4 | **MEDIUM** | `refresh-glossary.ts:91` — 20 sequential API calls for extraction, should parallelize |
| P5 | **MEDIUM** | `estimate-translation-progress.ts:31` — sequential fallback queries, could be parallelized |
| P6 | **MEDIUM** | `quality-warnings-aggregation.ts:74` — fetches ALL matching rows into memory with no LIMIT |
| P7 | **MEDIUM** | `get-reader-payload.ts:58-67` — `SELECT * FROM translations WHERE episodeId = ?` with no LIMIT — could return hundreds of failed retry rows |
| P8 | **MEDIUM** | `openrouter/models-cache.ts:213-216` — `getOpenRouterModelPricing` fetches all models for single price lookup |
| P9 | **LOW** | Title translation in `handleIngestAll` sends all episode titles in one LLM call — no limit on count |
| P10 | **LOW** | `render-glossary-prompt.ts:34-41` — re-sorts entries on every call |

---

## 8. V3 Review Cross-Reference (What's Still Open)

The [V3 review](./v3-review.md) identified 14 actionable issues. Status as of this review:

| V3 Issue | Description | Status (as of April 24) |
|----------|-------------|--------------------------|
| A1 | `loadSessionGlobalPrompt()` uses wrong user | ✅ **Fixed** — `translation-sessions.ts` line 315-325: `loadUserSettings(userId)` added |
| A2 | Failed translation left in "processing" | ❌ **Still open** — T30 above (`translation-sessions.ts:308-325`) |
| A3 | No duplicate session prevention | ❌ **Still open** — R1 above (`bulk-translate-all/route.ts:58-86`) |
| A4 | Session context only to first chunk | ❌ **Still open** — `request-translation.ts:325` |
| B1 | No glossary size cap | ❌ **Still open** — `render-glossary-prompt.ts` |
| B2 | Extraction too aggressive | ❌ **Still open** — `extract-glossary.ts:64-70` |
| B3 | Extraction re-suggests rejected terms | ❌ **Still open** |
| B4 | Version bumped too eagerly | ❌ **Still open** — T24 above |
| C1 | Single-paragraph text not chunked | ❌ **Still open** — `chunk-episode.ts:37-55` |
| C2-C7 | Chunking/quality issues | ❌ **Still open** |
| D1-D6 | UI issues | ❌ **Still open** |

**Open V3 issues: 13 of 14 remain.** Only A1 (wrong user for `loadSessionGlobalPrompt`) was fixed.

---

## 9. Code Quality Metrics

| Metric | Assessment |
|--------|-----------|
| **Modularity** | Good — clear module boundaries, 2 of 10 modules incomplete (admin, events) |
| **Consistency** | Mixed — Zod validation in most routes but manual validation in some; `logger` vs `console.error` split |
| **Type safety** | Mixed — strong Zod usage everywhere, but `job-handlers.ts` loses all type safety via `as JobHandler<unknown>` |
| **Error handling** | Mixed — good `apiError()` pattern but pervasive empty catch blocks |
| **Test coverage** | Weak — 74 tests (all passing) but heavily skewed to schema validation. Zero application-layer tests. |
| **Documentation** | Good — AGENTS.md, 16 docs in `docs/`, but `AGENTS.md` V3 status is stale |
| **Performance** | Fair — N+1 queries in 4 locations, no caching layer, sequential operations where parallel would work |
| **Security** | Needs work — SSE auth gap, no CSRF, no sign-in rate limiting |

---

## 10. Recommendations (Priority-Ordered)

### P0 — Must Fix (Correctness/Security)

1. **Fix `getClientIp` reverse proxy handling** (`rate-limit.ts:153`) — use `parts[0]` not `parts[parts.length - 1]`
2. **Add SSE authentication** (`events/route.ts`) — also noted in flash review, still unresolved
3. **Fix `bumpGlossaryVersion` race condition** (`glossary-entries.ts:270-293`) — use `ON CONFLICT DO UPDATE`
4. **Fix `importGlossaryEntries` N+1 queries** (`glossary-entries.ts:151-258`) — batch with `WHERE termJa IN (...)`
5. **Fix `SUM(DISTINCT cost)` in stats** (`get-reading-stats.ts:154`) — use proper dedup strategy
6. **Fix duplicate session prevention race** (`bulk-translate-all/route.ts:58-86`) — move session check inside deduplication lock
7. **Fix `signInWithEmail` race condition** (`session-auth.ts:79-104`) — use `ON CONFLICT DO NOTHING`
8. **Fix progress upsert race** (`update-progress.ts:29-62`) — use `ON CONFLICT DO UPDATE`
9. **Fix `discoverEpisodes` N+1 query** (`ingest-episodes.ts:29-53`) — batch existence check with `inArray`
10. **Fix `moveDelayedJobsToPending` race** (`job-runtime.ts:180-192`) — use Lua script or `ZPOPMIN`

### P1 — High Priority (Reliability)

11. **Add heartbeat/timeout for stuck "processing" translations** — stale recovery in background
12. **Fix session ordering guard silent stall** (`translation-sessions.ts:163-170`) — re-enqueue or resume
13. **Fix `ownerUserId: ""` in sessions** (`translation-sessions.ts:282`) — pass proper user context
14. **Add rate limiting to sign-in endpoint**
15. **Add CSRF protection to auth endpoints**
16. **Audit and replace all empty `catch {}` blocks** — minimum `logger.warn()` for traceability (also P0 in flash review, still unresolved)
17. **Standardize error logging** — migrate 12+ routes from `console.error` to `logger.error`

### P2 — Medium Priority (Quality / Maintainability)

18. **Add application-layer tests** — start with pure functions: `quality-validation.ts`, `chunk-episode.ts`, `prompt-fingerprint.ts`, `render-glossary-prompt.ts`
19. **Split overlong files** — `request-translation.ts` (extract truncation recovery), `translation-sessions.ts`, `glossary-entries.ts`
20. **Add structured error types** — replace `throw new Error("...")` with domain error classes
21. **Fix `job-handlers.ts` type safety** — use discriminated union instead of `as JobHandler<unknown>`
22. **Consolidate OpenRouter API calls** into a shared HTTP client — eliminate 4 duplicate implementations
23. **Parallelize sequential operations** — `loadTranslationContext`, `refresh-glossary.ts` extraction loop, `estimate-translation-progress.ts` fallback queries
24. **Add correlation ID** through the job lifecycle for tracing
25. **Add health endpoint** (`GET /api/health`) for Docker readiness probes — already exists at `src/app/api/health/route.ts` but verify production readiness

### P3 — Low Priority (Polish)

26. **Remove dead directories** — `src/features/`, `src/styles/`, `src/lib/cache/`, `src/lib/queue/`
27. **Update `AGENTS.md`** — V3 is implemented, not planned
28. **Populate `admin` module** — move admin route DB queries into the module's infra layer
29. **Complete `events` and `export` module layers** — add domain/infra/api layers
30. **Fix `i18n` .replace() to use global flag** — `replaceAll` or regex with `/g`
31. **Fix `overlapSourceTail` dead field** in `chunk-episode.ts` — either use it or remove it
32. **Fix `HTTP-Referer` header misspelling** (`translate-cache.ts:84`) — should be `Referer`
33. **Remove `src/` and `scripts/` from production Docker image**
34. **Add database integration tests** with a test container or in-memory SQLite
35. **Add E2E tests** for critical flows: register novel, read episode, translate, subscribe
36. **Add glossary size cap** — render max 200 confirmed entries (V3 review B1)
37. **Add chunk fallback for single-paragraph text** (V3 review C1)

---

## 11. Summary Statistics

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Translation Module | 5 | 16 | 10 | 31 |
| Identity Module | 2 | 6 | 2 | 10 |
| Library Module | 4 | 1 | 0 | 5 |
| Jobs Module | 3 | 3 | 1 | 7 |
| Source Module | 0 | 2 | 4 | 6 |
| Catalog Module | 1 | 6 | 0 | 7 |
| API Routes | 1 | 10 | 1 | 12 |
| Infrastructure (`lib/`) | 1 | 9 | 3 | 13 |
| Testing | 1 | 3 | 2 | 6 |
| Database Schema | 0 | 2 | 3 | 5 |
| Cross-Cutting | — | — | — | 7 patterns |
| Security | 1 | 5 | 1 | 7 |
| Performance | 2 | 6 | 2 | 10 |

**Total: 12 high, 69 medium, 29 low**

---

## 12. Compared to Prior Review (`deepseek-v4-flash`)

| Prior Recommendation | Status |
|----------------------|--------|
| P0 — Empty catch blocks | ❌ Still unresolved |
| P0 — SSE auth | ❌ Still unresolved |
| P1 — Test application layer | ❌ Still unresolved |
| P1 — Split overlong files | ❌ Still unresolved |
| P1 — N+1 in importGlossaryEntries | ❌ Still unresolved |
| P2 — Parallelize loadTranslationContext | ❌ Still unresolved |
| P2 — Configurable constants | ❌ Still unresolved |
| P2 — Health endpoint | ✅ Exists at `src/app/api/health/route.ts` |
| P2 — Correlation ID | ❌ Still unresolved |
| P3 — Remove source from Dockerfile | ❌ Still unresolved |
| P3 — CSRF protection | ❌ Still unresolved |

**Prior recommendations resolved: 1 of 12.**

---

*Report generated by deepseek-v4-pro. All line numbers reference the codebase as of review date.*
