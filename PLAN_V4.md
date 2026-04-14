# PLAN_V4

Last updated: 2026-04-14

## Scope Assumptions

- Authentication is intentionally lightweight. Email/password or external auth is out of scope.
- Profiles exist to separate per-user settings, prompts, and continue-reading state on the same installation.
- Subscriptions are intentionally site-wide and behave like a shared public library catalog.

These are product decisions, not defects. This plan excludes auth hardening and per-user subscription changes.

## Current Status

- Branch is clean on `phase-0-1-2-foundation`.
- Recent work includes V3 translation hardening, FIFO queue ordering, cost tracking, live episode updates, preface/afterword isolation, and `reingest-all`.
- Repo checks completed on 2026-04-14:
  - `pnpm test`: passed (`61` tests)
  - `pnpm check`: passed
  - `pnpm build`: passed
- The first local build failure was only due blocked Google Fonts network access in the sandbox, not application code.

## Valid Improvement Areas

### 1. Durable Rate Limiting And Cost Control

Current issue:
- Request throttling is process-local in-memory state.
- Limits reset on restart and do not coordinate across multiple app instances.
- Heavy routes such as glossary generation and bulk operations are still vulnerable to duplicated cost.

Plan:
- Replace the in-memory limiter with a durable Redis-backed limiter.
- Apply route-specific quotas to:
  - glossary generation
  - glossary extraction triggers
  - bulk translate all
  - reingest all
  - novel registration
  - ranking title translation
  - OpenRouter model listing
- Add per-user or per-profile keys where that is the real cost driver, and keep IP fallback for anonymous flows.
- Add idempotency or dedupe protection for expensive POST routes so repeat clicks do not create duplicated LLM work.
- Emit metrics for rate-limit hits, rejected costly requests, and estimated cost by operation type.

Expected outcome:
- Better abuse resistance
- Lower accidental OpenRouter spend
- Predictable behavior in Docker or multi-instance deployments

### 2. Polling Reduction And Status Consolidation

Current issue:
- Novel detail can poll through multiple overlapping paths:
  - page refresh timer
  - current job lookup
  - job detail lookup
  - episode list polling
  - per-episode translation status polling
- This multiplies database reads and JSON work while jobs are active.

Plan:
- Replace the fragmented polling model with one novel-level live status endpoint or SSE stream.
- Return in one payload:
  - active job summary
  - episode fetch states
  - translation states
  - progress estimates
  - counts used by status badges
- Remove per-episode badge polling once percent/progress can be included in the aggregated novel payload.
- Remove generic `router.refresh()` timers where direct client state updates are enough.
- Keep visibility-aware polling and add backoff once no active work remains.

Expected outcome:
- Lower server load during active translations
- Less client-side flicker
- Simpler data flow on the novel page

### 3. Query And Index Tuning

Current issue:
- Index coverage is thin for the hottest access patterns.
- Some endpoints still do avoidable N+1 queries or correlated subqueries.

Plan:
- Add indexes based on current query shapes:
  - `translations (episode_id, target_language, created_at desc)`
  - `translations (status, completed_at desc)`
  - partial index for active translations where `status in ('queued', 'processing')`
  - `job_runs (status, created_at desc)`
  - `job_runs (entity_type, entity_id, created_at desc)`
  - `job_runs (status, updated_at asc)` for stale recovery
  - `episodes (novel_id, episode_number)`
  - `episodes (novel_id, fetch_status, episode_number)`
  - `translation_sessions (novel_id, status)`
  - `novel_glossary_entries (novel_id, status, importance desc)`
- Replace per-row DB checks in ranking with one batched lookup on `source_ncode`.
- Replace the correlated latest-translation lookup on episode lists with `DISTINCT ON`, a window function, or a materialized latest-state query.
- Batch episode lookups in continue-reading instead of one query per row.
- Use `EXPLAIN ANALYZE` on admin metrics, novel detail, library, and translation status queries once indexes are added.

Expected outcome:
- Lower query latency on large novel catalogs
- Less load under active job polling
- Cleaner scaling as translations accumulate

### 4. OpenRouter And External API Usage Optimization

Current issue:
- OpenRouter model metadata is fetched in more than one place.
- Pricing/model data is cached only in-process.
- Some expensive LLM tasks still run inline on request paths.

Plan:
- Unify OpenRouter model and pricing fetching into one shared cache service.
- Store model/pricing metadata in Redis or Postgres with TTL instead of per-process memory only.
- Use one refresh path for:
  - `/api/openrouter/models`
  - cost estimation
  - model validation
- Move glossary generation to an async job so the request path is not tied to long LLM calls.
- Add dedupe for glossary generation per novel so repeated clicks reuse an in-flight job.
- Review model choice by workload:
  - main translation
  - session summary generation
  - glossary extraction
  - glossary generation
- Use cheaper/faster models where quality requirements are lower, especially for summary/extraction tasks.
- Persist translated novel metadata once generated so normal read paths do not keep depending on opportunistic translation cache misses.

Expected outcome:
- Lower OpenRouter spend
- Lower latency variance
- Fewer duplicated external calls

### 5. Observability And Operational Hardening

Current issue:
- Admin metrics exist, but the system still lacks enough signal around cost, queue lag, and API behavior to tune safely.

Plan:
- Expand admin metrics with:
  - queue lag
  - retry counts
  - stale recovery count
  - route-level rate-limit hit counts
  - OpenRouter error rates by operation
  - cost totals split by translation, summary, glossary generation, and extraction
- Reduce `console.error` scatter and route more operational logs through the shared logger.
- Add lightweight performance baselines for:
  - library page query time
  - novel detail query time
  - translation status query time
  - ranking query time
- Add smoke checks for live-status endpoints so future polling refactors stay safe.

Expected outcome:
- Safer tuning decisions
- Faster diagnosis when external API behavior changes
- Better visibility into actual cost drivers

## Recommended Execution Order

### Phase 1

- Durable rate limiting
- Expensive-route dedupe
- Shared OpenRouter metadata cache

### Phase 2

- Consolidated novel live-status endpoint
- Remove duplicate client polling paths

### Phase 3

- Add indexes
- Batch ranking and continue-reading queries
- Replace correlated latest-translation query

### Phase 4

- Async glossary generation job
- Workload-specific model selection
- Expanded admin metrics and cost breakdowns

## Non-Goals For V4

- Full authentication system
- Per-user subscriptions
- Reframing the app away from a shared library model

## Definition Of Done

- No process-local limiter remains on production-sensitive routes.
- Novel detail no longer performs overlapping polling for the same state.
- Ranking and continue-reading avoid avoidable N+1 query patterns.
- OpenRouter model/pricing metadata is fetched through one shared cache path.
- Admin metrics show enough information to track queue health, retries, cost, and API failures.
