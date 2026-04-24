# V5 — New Capabilities

Last updated: 2026-04-24

## Guiding Principle

V4 was "make what exists work better." V5 is "new capabilities" — new UI surfaces,
new read/export modes, and architectural upgrades. Each item introduces something
the user couldn't do before.

## Prerequisites

V4 is deployed and stable. The codebase has:
- Durable Redis-backed rate limiting and request dedupe
- Consolidated live-status polling
- Optimized queries with proper index coverage
- Shared OpenRouter model/pricing cache
- Workload-specific model routing
- Translation cost budgeting with session auto-pause
- `quality_warnings` JSONB on translations (7 automated checks, API-only)
- Admin API endpoints (no UI)
- Polling-only live updates

---

## V5 Items

### V5.1 — Quality Warnings Dashboard

**Problem:** Translation quality warnings exist in the DB (`quality_warnings` JSONB
on translations) and are exposed via `/api/admin/translations/quality`, but there is
no user-facing surface. Users cannot see which episodes have issues without hitting
the API directly.

**Plan:**
- New component on the novel detail page showing aggregated quality warnings
- Warning counts grouped by code (empty output, length anomaly, untranslated segments,
  paragraph mismatch, truncation, glossary non-compliance, chunk boundary artifacts)
- Filterable episode list showing only episodes with warnings above a severity threshold
- Per-episode warning detail expandable in the episode list
- Bulk action: "re-translate episodes with errors" targeting episodes with error-level warnings
- Severity badges (warning/error) visible in the reader model dropdown per-translation

**Scope:** New component, query aggregation, integration into novel detail and reader.

### V5.2 — Incremental Glossary Refresh

**Problem:** Glossary generation always samples from early episodes (first ~10). As a
novel progresses, new characters, locations, and terminology appear that the glossary
never captures. Manual glossary maintenance doesn't scale.

**Plan:**
- New job kind `glossary.refresh` that samples recent translations at intervals
  (episodes 50-60, 100-110, etc.) instead of always the first batch
- Sampling strategy: pick windows across the full translated range so the glossary
  reflects the current state of the story, not just the beginning
- Auto-trigger option: when `episodeCount` on a session exceeds a configurable
  threshold since the last glossary update, enqueue a refresh automatically
- Merge logic: new terms from refresh are added as `suggested` status, not
  auto-confirmed, so the user retains control
- Dedupe against existing confirmed entries to avoid duplicates

**Scope:** New job kind, sampling query, trigger logic in session advance, glossary
merge with conflict resolution.

### V5.3 — Selective Re-ingest by Checksum

**Problem:** `reingest-all` re-fetches every episode regardless of whether the source
changed. For a 500-episode novel, this means 500 HTTP requests to Syosetu when only
a handful of episodes may have been revised.

**Plan:**
- Fetch episode metadata first via the Syosetu API (`novelupdated_at` or per-episode
  timestamps if available)
- Compare against stored `updatedAtSource` or `rawHtmlChecksum` on each episode
- Only re-fetch episodes where the source has changed or the checksum is missing
- Fall back to full re-ingest if the metadata comparison API isn't available or fails
- Report skip counts in the job progress (e.g., "3 updated, 497 unchanged")

**Scope:** Changes to the ingest pipeline, new comparison step, metadata API
integration, job progress reporting.

### V5.4 — Reading Statistics Page

**Problem:** Users have no visibility into their reading habits, translation
consumption, or cost per read episode. All data exists in the DB but isn't surfaced.

**Plan:**
- New `/stats` page
- Aggregations from `reading_progress`:
  - Episodes read per week/month (bar chart or table)
  - Reading streaks (consecutive days with progress updates)
  - Total episodes read, total novels touched
- Translation consumption by model (which models produced the translations the user
  actually read)
- Cost per read episode (total cost / episodes with reading progress)
- All derived from existing `reading_progress`, `translations`, and `subscriptions`
  data — no new tracking needed

**Scope:** New page, new query aggregation endpoint, i18n keys, potential lightweight
chart component.

### V5.5 — SSE Live Updates

**Problem:** All live updates use polling (15s intervals on library, 5s on novel
detail). This creates unnecessary load when nothing is happening and introduces
latency when jobs complete.

**Plan:**
- Redis pub/sub channel per novel (e.g., `novel:{novelId}:events`)
- Worker publishes progress events on translation completion, job state changes,
  and ingest progress
- New SSE endpoint: `GET /api/novels/[novelId]/events`
- Client replaces polling with `EventSource` on novel detail and library pages
- Event types: `job.progress`, `job.complete`, `translation.complete`,
  `episode.ingested`, `session.status`
- Graceful fallback: if SSE connection drops or fails to establish, revert to
  current polling behavior transparently
- Visibility-aware: pause SSE connection when tab is hidden, reconnect on focus

**Scope:** Redis pub/sub setup, new SSE endpoint, worker event publishing, client
EventSource integration with fallback, connection lifecycle management.

### V5.6 — Translation Comparison Mode

**Problem:** When a novel has translations from multiple models (e.g., Gemini Flash
vs Claude Haiku), there's no way to compare them side by side. Users must toggle
between translations one at a time in the reader.

**Plan:**
- New reader view mode: side-by-side or toggle comparison
- Paragraph-aligned display showing two translations of the same episode
- Model selection dropdowns for left/right panels
- Diff highlighting for divergent paragraphs (optional, can be toggled)
- Useful for model evaluation: helps users decide which model to use for bulk
  translation based on quality comparison on a sample episode

**Scope:** New reader component/mode, paragraph alignment logic, diff rendering,
model selection UI.

### V5.7 — PWA / Offline Support

**Problem:** The app requires an internet connection for all reading. Users on
commutes or in low-connectivity environments cannot read previously loaded episodes.

**Plan:**
- Service worker that caches read episodes (both JA source and KO translation)
- "Available offline" indicator per episode in the episode list
- Pre-cache option: download N next episodes for offline reading
- Background sync for reading progress updates (queue progress writes and sync
  when connectivity returns)
- App manifest for "Add to Home Screen" on mobile
- Cache invalidation when a new translation replaces an old one

**Scope:** Service worker setup, caching strategy, offline UI indicators, background
sync, manifest, significant frontend work.

### V5.8 — EPUB Export

**Problem:** Users cannot read translated novels outside the web app. No way to
transfer translations to an e-reader or read offline in a dedicated reading app.

**Plan:**
- New endpoint: `GET /api/novels/[novelId]/export?format=epub`
- Render novel metadata (title, author, summary) + episode translations into EPUB
  format
- Include table of contents generated from episode titles
- Include glossary as an appendix
- Support exporting a range of episodes (not just the full novel)
- Respect the user's preferred translation (latest by configured model)

**Scope:** EPUB generation library (e.g., `epub-gen` or manual ZIP+XHTML assembly),
new API endpoint, download UI on novel detail page.

### V5.9 — Favorite Models for Quick Selection

**Problem:** The model dropdown in settings and the glossary/reader surfaces
enumerates the full OpenRouter catalog (filtered to 30 rows in
`novel-glossary-editor.tsx:864`). Users who frequently switch between a small set
of models (e.g., `deepseek/deepseek-v4-flash`, `anthropic/claude-haiku`) must
scroll or re-type every time. No way to pin preferred models.

**Plan:**
- New `favorite_models` column (text array) on `user_settings` (or equivalent
  per-user settings row)
- New endpoints: `POST /api/settings/favorite-models` (add), `DELETE` (remove)
- UI: star/unstar toggle on each model row in the model picker
- Favorites rendered as a pinned section at the top of every model dropdown
  (settings page, novel-level model override, glossary generator, translation
  comparison picker in V5.6)
- Auto-seed favorites from the 3 most-recently-used models on first load if
  the user has no favorites
- Keep the full catalog searchable below the favorites section

**Scope:** Schema migration, CRUD endpoints, shared `<ModelPicker>` component
refactor, settings UI, seed logic based on translation history.

### V5.10 — Increase Glossary Prompt Limit to 200

**Problem:** `render-glossary-prompt.ts` caps the glossary injected into
translation prompts at `MAX_PROMPT_ENTRIES = 50`. Mid-to-long novels routinely
accumulate 100+ confirmed entries; anything beyond 50 is silently dropped
(shown as `(+N entries omitted)`). Cheap, high-context models (Gemini 2.5,
DeepSeek V4) can handle far more without hitting context limits, so the cap
is leaving translation quality on the table.

**Plan:**
- Raise `MAX_PROMPT_ENTRIES` from 50 → 200 in `render-glossary-prompt.ts:1`
- Audit prompt size impact: 200 entries × avg ~60 chars/row ≈ 12K extra chars
  (~3K tokens). Verify this stays within per-model context budget across all
  configured workloads (translation, summary, extraction, title)
- If context is tight for lower-tier models, make the cap configurable per
  workload via `OPENROUTER_*_GLOSSARY_CAP` env vars (fall back to 200)
- Update `quality-validation.ts` compliance check to reflect new cap (if it
  assumes all confirmed entries are injected)
- Bump any test fixtures that assume the 50-entry ceiling

**Scope:** One-line constant bump + context-budget verification + per-workload
override if needed. Smallest V5 item, highest translation-quality-per-loc ratio.

---

## Recommended Phasing

### Phase A — Data Surfaces (low risk, high visibility)

| Item | Dependencies |
|------|-------------|
| V5.1 Quality Warnings Dashboard | None — data already exists |
| V5.4 Reading Statistics Page | None — data already exists |

These are read-only surfaces over existing data. No pipeline changes, no new
jobs, no architectural shifts. Ship first for immediate value.

### Phase B — Pipeline Intelligence

| Item | Dependencies |
|------|-------------|
| V5.2 Incremental Glossary Refresh | V5.1 helps validate quality improvements |
| V5.3 Selective Re-ingest | None |

Changes to job behavior. Each is self-contained but benefits from the quality
dashboard (V5.1) to verify that glossary refresh actually improves output.

### Phase C — Real-time and Comparison

| Item | Dependencies |
|------|-------------|
| V5.5 SSE Live Updates | Redis pub/sub (infrastructure) |
| V5.6 Translation Comparison | Multiple translations per episode (existing) |

Architectural upgrade (SSE) and new reader mode. SSE is the biggest infrastructure
change in V5. Comparison mode is independent but pairs well since SSE can push
"new translation ready" events to trigger comparison availability.

### Phase D — Offline and Export

| Item | Dependencies |
|------|-------------|
| V5.7 PWA / Offline | Service worker complexity |
| V5.8 EPUB Export | None, but benefits from stable translation pipeline |

Heaviest frontend work. PWA requires thorough testing across browsers and devices.
EPUB is self-contained but benefits from a stable translation quality baseline.

### Phase E — Quality of Life

| Item | Dependencies |
|------|-------------|
| V5.9 Favorite Models | None — pairs well with V5.6 comparison picker |
| V5.10 Glossary Limit 200 | None — single constant bump |

Low-risk, high-frequency UX wins. Can ship at any time, independent of other
phases. V5.10 should ship first (trivial), V5.9 alongside or after V5.6.

---

## Non-Goals for V5

- Full authentication system (OAuth, email/password)
- Per-user subscription isolation
- Multi-language translation beyond Korean
- Mobile native app
- Collaborative features (shared annotations, comments)

## Definition of Done

- Quality warnings are visible on novel detail and in the reader
- Glossary refresh runs automatically based on translation progress
- Re-ingest skips unchanged episodes and reports skip counts
- Reading statistics page shows weekly/monthly reading activity
- SSE replaces polling for novel detail live updates with polling fallback
- Two translations can be compared side-by-side in the reader
- Read episodes are available offline via service worker
- Translated novels can be exported as EPUB
- Favorite models appear pinned at top of every model picker
- Glossary prompt cap raised to 200 entries with context-budget guardrails
