# V3 Architecture Plan — Translation Quality & Context

Last updated: 2026-04-12

## Purpose

V3 focuses on translation quality. V1 built the product loop; V2 added
durability, multi-user, and observability. V3 addresses three structural
weaknesses in the current translation pipeline:

1. **Glossary is static and unstructured** — generated once from 10 episodes,
   stored as free-text markdown, never updated as the novel progresses.
2. **Episodes are translated in isolation** — no context carries between
   episodes, so the model rediscovers character relationships, tone, and
   terminology from scratch each time.
3. **API calls are unoptimized** — no prompt caching, no batching, no chunking
   for long episodes, no quality validation.

## Technical Review

### Current Strengths
- Durable Redis-backed job queue with retry/backoff
- Per-novel glossary injected into system prompt
- Per-user global prompt and model selection
- Translation deduplication via 6-column identity index
- Cost tracking and ETA estimation from historical data
- Bulk translate-all with progress reporting

### Current Constraints
- **Glossary is fire-and-forget**: generated from first 10 episodes, then only
  manually edited. New characters, terms, and tone shifts introduced in later
  episodes are never reflected unless the user regenerates manually.
- **No structured glossary data**: the glossary is a single markdown blob
  injected verbatim. There is no term-level lookup, conflict detection, or
  category filtering.
- **Zero cross-episode context**: each `translation.episode` job builds an
  independent OpenRouter request. The model has no awareness of what happened in
  episode N-1 when translating episode N.
- **No prompt caching**: the system prompt (base rules + global prompt +
  glossary) is re-sent from scratch for every episode. Models that support
  prefix caching (Anthropic, Google) never benefit because each request is
  isolated.
- **No long-episode handling**: `max_tokens: 8192` is hardcoded. Long episodes
  may be truncated or produce incomplete translations. There is no chunking or
  adaptive limit.
- **No quality gate**: translations go straight from `processing` to
  `available`. There is no automated check for untranslated segments, length
  anomalies, or glossary violations.

### Product Decisions Carried Into V3
- **Translations are shared artifacts**: translation rows, glossary entries, and
  session context are shared at the novel level across all profiles. Profiles
  only scope reading progress, UI preferences, and default model/prompt
  settings.
- **Gemini-on-OpenRouter is the default optimization target**: V3 should
  optimize message layout, cacheability, and telemetry primarily for Gemini via
  OpenRouter, while keeping Anthropic/OpenAI-compatible models usable through
  the same provider abstraction.

---

## V3 Architectural Decisions

### 1. Structured Glossary with Living Updates

**Decision**: Split the glossary into two layers — a **structured term table**
for machine-parseable entries and a **style guide** free-text field for
prose-level guidance.

**Schema: `novel_glossary_entries`**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `novel_id` | uuid FK → novels | |
| `term_ja` | text NOT NULL | Japanese term (kanji/kana) |
| `term_ko` | text NOT NULL | Korean rendering |
| `reading` | text | Furigana/reading aid |
| `category` | enum | `character`, `place`, `term`, `skill`, `honorific` |
| `notes` | text | Context, disambiguation, usage rules |
| `source_episode_number` | integer | Episode where this term first appeared |
| `status` | enum | `confirmed`, `suggested`, `rejected` |
| `confidence` | real | Optional extractor confidence for suggested terms |
| `provenance_translation_id` | uuid FK → translations | Translation that produced this suggestion |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| UNIQUE | | `(novel_id, term_ja, category)` |

The existing `novel_glossaries` table retains the free-text `glossary` column,
repurposed as the **style guide** (tone rules, speech-level conventions,
narrator voice notes). The structured entries and the style guide are combined
when building the system prompt.

**Scope**: Glossary entries are shared per novel, not per profile. A confirmed
term represents the canonical rendering for that novel unless deliberately
edited.

**Revision tracking**: Add a `glossary_version` integer on `novel_glossaries`
that increments whenever confirmed entries or the style guide change. This
version feeds translation identity and session auditability.

**Prompt injection format**: Structured entries are rendered as a compact
markdown table grouped by category, followed by the style guide text. This
produces a deterministic, cacheable prompt prefix.

### 2. Post-Translation Glossary Extraction

**Decision**: After each episode translation completes, enqueue a lightweight
`glossary.extract` background job that identifies new or changed terms.

**Flow**:
1. `translation.episode` job completes → status becomes `available`
2. Worker enqueues `glossary.extract` with `{ novelId, episodeId, episodeNumber }`
3. The extraction job:
   a. Loads the episode's source text (truncated to ~4000 chars) and translated
      text (truncated to ~4000 chars)
   b. Loads existing confirmed glossary entries for the novel
   c. Sends an extraction prompt asking the model to return **only new or
      changed** terms as structured JSON
   d. Parses the response and upserts entries with `status: 'suggested'`
4. Suggested entries appear in the glossary management UI for user review

**Cost control**: The extraction call uses a small, cheap model (e.g.
`gemini-2.5-flash-lite`) with low max_tokens (~2048). It runs only on the
first translation of each episode that passes basic quality validation.

**Structured output requirement**: Use OpenRouter structured outputs with a
strict JSON schema instead of relying on prompt-only JSON compliance. This
reduces parser fragility and makes extraction failures observable.

**Refresh rule**: If a later retranslation becomes the canonical best available
translation for the episode and differs materially from the prior source
artifact, allow a manual or deferred re-extraction path instead of permanently
locking the glossary to the first translation.

**Extraction prompt output format** (enforced via system prompt):
```json
[
  {
    "term_ja": "黒崎一護",
    "term_ko": "쿠로사키 이치고",
    "reading": "くろさきいちご",
    "category": "character",
    "notes": "Main protagonist"
  }
]
```

### 3. Translation Sessions with Context Chaining

**Decision**: Introduce a **translation session** that groups sequential episode
translations and carries context forward via a rolling summary.

**Schema: `translation_sessions`**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `novel_id` | uuid FK → novels | |
| `status` | enum | `active`, `completed`, `cancelled` |
| `model_name` | text | Model locked for this session |
| `glossary_version` | integer | Snapshot counter at session start |
| `prompt_fingerprint` | text | Hash of stable prompt inputs for audit/dedupe |
| `context_summary` | text | Rolling summary, updated after each episode |
| `last_episode_number` | integer | Most recent completed episode |
| `episode_count` | integer | Total episodes translated in session |
| `total_cost_usd` | real | Running cost total |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Also add to `translations` table:**
- `session_id` uuid FK → translation_sessions (nullable)
- `context_summary_used` text (nullable) — the summary injected for this
  translation, for auditability
- `prompt_fingerprint` text (nullable) — hash of model + prompt version +
  glossary version + style guide + global prompt + session context mode
- `is_canonical` boolean (default `false`) — marks the translation selected as
  the shared preferred artifact for the episode/model family if you later want a
  stronger selection policy than "latest available"

**Session lifecycle**:

1. **Creation**: When a bulk-translate-all is triggered, create a session.
   Single-episode translations remain sessionless (backward-compatible).
2. **Ordering**: The session is advanced by a dedicated orchestrator job
   (`translation.session-advance`) that processes exactly one episode at a time
   in `episode_number` ascending order.
3. **Context injection**: For each episode N in the session, the translation
   request includes a context message between system and user:
   ```
   System: [base rules + glossary + global prompt]   ← cacheable prefix
   User (context): [rolling summary from episodes 1..N-1]
   User (translate): Translate the following Japanese text to Korean:
   
   [source text of episode N]
   ```
4. **Summary generation**: After episode N's translation completes, a
   lightweight summary call generates a ~500-word context summary covering:
   - Key plot events in this episode
   - New character introductions or relationship changes
   - Tone/mood shifts
   - The summary replaces the prior `context_summary` on the session row
5. **Session completion**: When all episodes are processed, the session status
   becomes `completed`.

**Summary prompt strategy**: The summary call receives the episode's source text
(truncated) and translation (truncated), plus the previous rolling summary. It
produces a **replacement** summary (not an append), keeping the total under
~2000 chars. This bounds context window growth regardless of novel length.

**Backward compatibility**: Episodes translated outside a session (single
requests, ad-hoc retranslations) work exactly as today — no session, no context
injection. The session is an opt-in enhancement for bulk sequential work.

**Failure policy**: If episode N exhausts retries, the orchestrator explicitly
marks that episode as failed for the session and then either:
- continues to N+1 with the prior summary unchanged, or
- pauses the session if the user selected strict sequential consistency.

Default behavior should be continue-with-warning so one bad episode does not
stall a long run.

### 4. Prompt Caching Optimization

**Decision**: Restructure the OpenRouter request to maximize prompt prefix
caching for providers that support it.

**Cache-friendly prompt structure**:
```
┌─────────────────────────────────────────┐
│ System message (stable across episodes) │  ← CACHED
│  • Base translation rules               │
│  • Global prompt (user settings)        │
│  • Structured glossary entries (table)  │
│  • Style guide (free text)             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ User message 1: Context (per-session)   │  ← CACHED within session
│  • Rolling summary of prior episodes    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ User message 2: Source text             │  ← NEW each episode
│  • "Translate the following..."         │
└─────────────────────────────────────────┘
```

For providers with prefix caching (Anthropic Claude, Google Gemini), the system
message is cached across all episodes of a session. The context message is
cached between consecutive episodes within the same session.

**Implementation**: Optimize first for Gemini through stable prefix layout and
fast sequential dispatch. Treat provider-specific caching controls as optional
enhancements, not as guaranteed behavior across all models routed by
OpenRouter. The optimization is:
- keep stable content in earlier messages and variable content at the end
- record token usage metadata, including cached-token details when provided
- prefer Gemini-compatible message shapes as the default path
- leave room for Anthropic-specific `cache_control` handling behind the provider
  abstraction if enabled later

**Measurable benefit**: For a 50-episode bulk session with a ~3000-token system
prompt, caching avoids re-processing ~150K input tokens. At typical pricing
this can save substantial input cost on cache-friendly Gemini runs, but the
exact percentage should be measured from production token telemetry rather than
assumed in advance.

### 5. Long Episode Handling

**Decision**: Implement intelligent chunking for episodes that exceed a
configurable source-character threshold.

**Chunking strategy**:
1. **Threshold**: If `normalizedTextJa.length > 12000` characters (~6000
   tokens), chunk the episode.
2. **Split points**: Split at double-newline paragraph boundaries. If no double
   newline exists within the target chunk size, fall back to single newline.
3. **Overlap context**: Each chunk after the first includes the last 2
   paragraphs of the previous chunk's **source text** as a dedicated context
   message, so the model maintains continuity without requiring brittle
   post-processing of translated overlap text.
4. **Reassembly**: Chunk translations are concatenated with the original
   paragraph breaks preserved.
5. **Storage**: The final concatenated translation is stored as a single
   `translatedText` value. Chunk boundaries are not exposed to the reader.

**Adaptive max_tokens**: Calculate `max_tokens` as
`ceil(sourceChars * 1.5 / 3) + 512` (assuming ~3 chars/token for Korean and a
1.5x expansion ratio from Japanese), clamped to `[2048, 16384]`.

### 6. Post-Translation Quality Validation

**Decision**: Add a validation step between `processing` and `available` that
catches common translation defects without blocking the pipeline.

**Validation checks** (run synchronously within the translation job, no extra
API call):

| Check | Method | Action on fail |
|-------|--------|---------------|
| **Length ratio** | `translatedLength / sourceLength` outside `[0.5, 3.0]` | Flag as `warning` |
| **Untranslated segments** | Regex for 3+ consecutive Japanese-only sentences in output | Flag as `warning` |
| **Empty output** | `translatedText.trim().length === 0` | Set status `failed` |
| **Glossary compliance** | Check confirmed glossary entries appear in translation when their `term_ja` appears in source | Flag as `warning` |
| **Chunk continuity** | Detect duplicated tail/head spans across adjacent chunk outputs | Flag as `warning` |

**Warning vs. failure**: Only empty output causes a hard `failed` status.
Other checks produce a `quality_warnings` JSONB column on the translation row.
The reader UI can display a subtle indicator when warnings are present, and the
glossary compliance check helps identify terms the model is inconsistently
handling.

**Schema addition to `translations`**:
- `quality_warnings` jsonb (nullable) — array of `{ check, message, severity }`

### 7. Batch Request Optimization (Deferred)

**Decision**: Defer true batch API support (e.g. OpenRouter batch endpoints)
to post-V3. The prompt caching and session chaining in V3 already deliver the
majority of cost savings. Batch endpoints add complexity around delayed delivery
and status polling that is not worth the trade-off for the current usage scale.

---

## Module Responsibility Changes

### `translation` (expanded)
- Own session lifecycle: create, advance, complete, cancel
- Own glossary extraction pipeline: enqueue, parse, merge
- Own quality validation: run checks, store warnings
- Own chunking logic: split, translate chunks, reassemble
- Own prompt assembly: structured glossary rendering, context injection, cache
  layout

### `jobs` (new job kinds)
- `glossary.extract` — post-translation term extraction
- `translation.session-summary` — context summary generation after each episode
  in a session
- `translation.session-advance` — orchestrates one sequential session step and
  enqueues the next episode only after translation + summary commit
- `translation.episode` — unchanged in purpose, but payload gains optional
  `sessionId`, `contextSummary`, `promptFingerprint`, and chunk metadata

### `catalog` (unchanged)

### `reader` (minor)
- Surface `quality_warnings` presence in reader payload for UI indicator

---

## Implementation Phases

### V3.1 — Structured Glossary Foundation

**Goal**: Replace the single markdown blob with a structured term table + style
guide, with a dedicated management UI.

**Changes**:
1. Create `novel_glossary_entries` table (migration)
2. Add `glossary_entry_status` and `glossary_entry_category` PG enums
3. Add `glossary_version` to `novel_glossaries`
4. CRUD API routes: `GET/POST/PUT/DELETE /api/novels/[novelId]/glossary/entries`
5. Bulk import endpoint: `POST /api/novels/[novelId]/glossary/entries/import`
   (accepts JSON array, used by both manual import and auto-extraction)
6. Modify `buildSystemPrompt()` in `openrouter-provider.ts` to render
   structured entries as a markdown table, followed by style guide text
7. Glossary management UI: spreadsheet-style table with inline editing, category
   filters, status toggles (confirmed/suggested/rejected), and a "Style guide"
   textarea below the table
8. Migration path: existing `novel_glossaries.glossary` content moves to the
   style guide field; no data loss

**Acceptance criteria**:
- Glossary entries are CRUD-able via API and UI
- Confirmed entries appear in the translation system prompt
- Suggested/rejected entries do not appear in the prompt
- Existing glossary text preserved as style guide
- Confirming or editing entries increments `glossary_version`
- `pnpm check` green

### V3.2 — Post-Translation Glossary Extraction

**Goal**: Automatically extract new terms after each episode is translated,
feeding the structured glossary with suggested entries.

**Changes**:
1. New `glossary.extract` job kind and handler
2. Extraction prompt with OpenRouter structured output schema
3. Term deduplication: skip entries where `(novel_id, term_ja, category)`
   already exists with `confirmed` status
4. Hook in `processQueuedTranslation`: after successful translation, enqueue
   `glossary.extract` if this is the first successful quality-passing
   translation for the episode
5. UI: "Suggested" badge count on glossary tab; bulk confirm/reject actions
6. Cost tracking: extraction job costs recorded in `job_runs`

**Acceptance criteria**:
- Translating a new episode produces suggested glossary entries
- Retranslating an already-translated episode does not re-extract
- Suggested entries are visible in the glossary UI with confirm/reject controls
- Extraction cost is recorded and visible in admin metrics
- Malformed extractor responses are surfaced as observable job failures, not
  silent drops

### V3.3 — Translation Sessions & Context Chaining

**Goal**: Bulk translations carry context forward so the model maintains
consistency across episodes.

**Changes**:
1. Create `translation_sessions` table (migration)
2. Add `session_id`, `context_summary_used`, and `prompt_fingerprint` columns to
   `translations`
3. New `translation.session-advance` job kind to process one episode at a time
4. Modify `bulk-translate-all` handler to create a session and enqueue the
   first session-advance job instead of queueing all episodes independently
5. New `translation.session-summary` job kind: after each episode in a session,
   generate a rolling ~2000-char summary
6. Modify `processQueuedTranslation` to inject context summary into the prompt
   when `sessionId` is present
7. Modify prompt structure: system message → context message → translate message
8. Session status tracking: progress bar in UI showing session advancement
9. Session management UI: view active/completed sessions on novel detail page

**Acceptance criteria**:
- Bulk translate-all creates a session and processes episodes in order
- Each episode after the first receives a context summary from prior episodes
- Context summary is stored on the translation row for auditability
- Single-episode translations continue to work without sessions
- Session progress is visible in the novel detail UI
- A failed episode does not deadlock the entire session

### V3.4 — Prompt Caching & Request Optimization

**Goal**: Maximize prompt cache hits and handle long episodes gracefully.

**Changes**:
1. Restructure `OpenRouterProvider` to accept a multi-message array instead of
   building a single system+user pair
2. Separate system message (stable) from context message (per-session) from
   source message (per-episode)
3. Implement episode chunking: detection, splitting, overlap context, reassembly
4. Adaptive `max_tokens` calculation based on source length
5. Add `chunk_count` column to `translations` for observability
6. Add prompt token tracking: persist prompt/completion token counts and cached
   token details when the provider returns them
7. Make Gemini/OpenRouter the default optimized request path; keep other models
   available through the same provider abstraction

**Acceptance criteria**:
- System prompt is identical across episodes in a session (enables caching)
- Long episodes (>12K chars) are chunked and reassembled correctly
- `max_tokens` scales with source text length
- No regression in translation quality for normal-length episodes
- Cached-token telemetry is visible enough to confirm whether optimization is
  working on Gemini runs

### V3.5 — Quality Validation & Observability

**Goal**: Catch translation defects automatically and surface quality signals.

**Changes**:
1. Add `quality_warnings` jsonb column to `translations`
2. Implement validation checks in `processQueuedTranslation` post-translation
3. Reader payload includes `hasWarnings` boolean for UI indicator
4. Glossary compliance check: compare confirmed entries against source/target
5. Admin endpoint: `GET /api/admin/translations/quality` — aggregate warning
   statistics by check type and model
6. Novel detail: quality summary showing warning rates per model

**Acceptance criteria**:
- Empty translations are marked `failed`
- Length ratio and untranslated-segment warnings are recorded
- Glossary compliance warnings identify missed terms
- Quality warnings are visible in admin and novel detail views
- No false positives on normal translations (validate against existing corpus)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extraction LLM returns malformed JSON | Suggested entries silently dropped | Lenient parser with fallback regex extraction; log failures |
| Context summary drifts or hallucinates | Downstream translations inherit errors | Summary is advisory, not authoritative; glossary entries are the source of truth for terms |
| Chunking produces awkward splits | Translation quality at chunk boundaries | Overlap context + paragraph-boundary splitting; manual override for known problem episodes |
| Prompt caching not effective for some models | No cost savings on those models | Caching is structural, not behavioral — no downside if provider ignores it |
| Glossary grows too large for context window | System prompt exceeds model limits | Cap at 500 confirmed entries per novel; archive old entries; paginate rendering |
| Session processing order blocked by failed episode | Session stalls | Skip failed episodes after retry exhaustion; mark session partially complete |
| Shared translations regress after a bad retranslation | All profiles see worse default output | Add canonical selection policy and avoid auto-promoting new translations blindly |

---

## Migration Notes

- **No breaking changes**: All V3 features are additive. Existing translations,
  glossaries, and settings remain valid.
- **`promptVersion` bump**: When V3.3 (context chaining) lands, bump
  `PROMPT_VERSION` from `"v2"` to `"v3"`. This allows the identity index to
  distinguish context-aware translations from context-free ones. The bump only
  applies to session-based translations; sessionless translations keep `"v2"`.
- **Prompt identity**: `promptVersion` alone is not sufficient for V3 dedupe.
  Add a `prompt_fingerprint` derived from prompt-affecting inputs so style-guide
  and glossary changes produce distinct translation artifacts.
- **Glossary migration**: The existing `novel_glossaries.glossary` text becomes
  the style guide. A one-time migration script can optionally parse existing
  markdown glossaries into structured entries, but this is best-effort — the
  free text is preserved regardless.

---

## Definition of Ready for V3 Implementation

The repo is ready to begin V3 when:
- V2 is fully shipped and stable (current state: all V2 phases complete)
- `pnpm check` and `pnpm test` pass
- This architecture document is reviewed and approved
- The glossary entry schema is finalized (V3.1 is the first implementation
  target)

---

## Immediate Execution Plan

The next step after architecture approval is to convert V3 into a sequence of
small, testable slices. The recommended order is:

1. **V3.0 groundwork** — prompt identity, glossary revisioning, and canonical
   shared-artifact rules
2. **V3.1 structured glossary foundation** — schema, CRUD, prompt rendering, UI
3. **V3.2 extraction loop** — suggested-term generation and review flow
4. **V3.3 session orchestration** — sequential processing before richer context
5. **V3.4 caching/chunking** — provider-aware optimization and long-episode path
6. **V3.5 quality signals** — warnings, reporting, and promotion safeguards

### V3.0 — Groundwork Checklist

This is a short enabling slice that should land before or together with V3.1.
It resolves translation identity and shared-artifact rules so later phases do
not have to retrofit them.

**Goal**: make shared novel-wide translation artifacts explicit and safe to
evolve.

**Checklist**:
1. Add `glossary_version` to `novel_glossaries` with default `1`
2. Add `prompt_fingerprint` to `translations`
3. Decide and document how `prompt_fingerprint` is computed
   - minimum inputs: `provider`, `modelName`, `promptVersion`,
     `globalPrompt`, `styleGuide`, `glossaryVersion`, `sessionMode`
4. Add a canonical-selection rule for shared translations
   - initial recommendation: latest successful translation remains visible, but
     do not auto-promote a new translation over an existing one if it fails
5. Update translation identity checks to use `prompt_fingerprint` alongside the
   current identity dimensions
6. Add migration notes so existing rows remain queryable even with null
   `prompt_fingerprint`

**Code areas likely touched**:
- `src/lib/db/schema/translations.ts`
- `src/modules/translation/application/request-translation.ts`
- `src/modules/reader/application/get-reader-payload.ts`
- `drizzle/*`

**Acceptance criteria**:
- Changing glossary/style-guide content changes translation identity
- Existing V2 translations still load in the reader
- Shared-artifact behavior is documented and reflected in code comments where
  needed

### V3.1 — Structured Glossary Foundation Checklist

**Goal**: replace the free-text-only glossary with a shared structured glossary
plus style guide, without breaking the existing translation flow.

#### 1. Schema and Migration

**Checklist**:
1. Create `glossary_entry_status` enum with `confirmed`, `suggested`, `rejected`
2. Create `glossary_entry_category` enum with:
   `character`, `place`, `term`, `skill`, `honorific`
3. Create `novel_glossary_entries` table with:
   - `id`
   - `novel_id`
   - `term_ja`
   - `term_ko`
   - `reading`
   - `category`
   - `notes`
   - `source_episode_number`
   - `status`
   - `confidence`
   - `provenance_translation_id`
   - timestamps
4. Add unique constraint on `(novel_id, term_ja, category)`
5. Add `glossary_version` to `novel_glossaries`
6. Backfill existing `novel_glossaries.glossary` as style-guide content only

**Acceptance criteria**:
- Migration runs cleanly on an existing V2 database
- Existing glossary text is preserved
- Empty novels can exist without any structured glossary entries

#### 2. Domain and Application Layer

**Checklist**:
1. Add glossary entry types and Zod schemas under `src/modules/translation`
2. Add application functions for:
   - list glossary entries
   - create entry
   - update entry
   - delete entry
   - bulk import entries
   - update style guide
3. Increment `glossary_version` whenever:
   - a confirmed entry is created
   - a confirmed entry is edited
   - a confirmed entry is deleted
   - the style guide changes
4. Do not increment `glossary_version` for suggested/rejected-only review
   changes unless a term becomes confirmed
5. Keep term ordering deterministic for prompt rendering
   - recommended order: category, then `term_ja`

**Code areas likely touched**:
- `src/modules/translation/domain/*`
- `src/modules/translation/application/*`
- `src/modules/translation/api/*`

**Acceptance criteria**:
- CRUD operations are idempotent and validated
- `glossary_version` changes only when translation-affecting content changes
- Bulk import can upsert known entries safely

#### 3. API Surface

**Checklist**:
1. Add `GET /api/novels/[novelId]/glossary/entries`
2. Add `POST /api/novels/[novelId]/glossary/entries`
3. Add `PUT /api/novels/[novelId]/glossary/entries/[entryId]`
4. Add `DELETE /api/novels/[novelId]/glossary/entries/[entryId]`
5. Add `POST /api/novels/[novelId]/glossary/entries/import`
6. Extend existing glossary route so it clearly represents the style guide and
   glossary metadata, not the old free-form artifact only
7. Validate payload size and text limits to avoid oversized prompt artifacts

**Acceptance criteria**:
- APIs return enough metadata for UI state without extra round-trips
- Invalid category/status values fail with 400-level responses
- Import route supports the later extractor payload shape

#### 4. Prompt Rendering Integration

**Checklist**:
1. Refactor `OpenRouterProvider` prompt building so glossary rendering is a
   separate pure function
2. Render only `confirmed` structured entries into the system prompt
3. Append the style guide after the structured glossary block
4. Keep rendering deterministic to improve cacheability and identity hashing
5. Add unit tests for prompt rendering edge cases
   - no entries + no style guide
   - entries only
   - style guide only
   - mixed categories
   - long notes trimmed or bounded if needed

**Code areas likely touched**:
- `src/modules/translation/infra/openrouter-provider.ts`
- new helper under `src/modules/translation/application/` or `infra/`

**Acceptance criteria**:
- Prompt structure is stable for the same glossary/style-guide state
- Suggested/rejected terms never appear in the translation prompt

#### 5. UI and UX

**Checklist**:
1. Replace the current single-textarea glossary editor with:
   - structured term table
   - filters by category/status
   - inline edit/create/delete
   - style-guide textarea
2. Preserve a simple editing experience
   - avoid requiring spreadsheet-heavy interactions for small novels
3. Show separate counts for:
   - confirmed
   - suggested
   - rejected
4. Add lightweight affordances for manual curation
   - confirm
   - reject
   - revert to suggested if needed later
5. Keep the style-guide area clearly labeled as prose-level guidance

**Code areas likely touched**:
- `src/components/novel-glossary-editor.tsx`
- `src/app/novels/[novelId]/page.tsx`
- `src/lib/i18n/dictionaries.ts`

**Acceptance criteria**:
- Existing users can still edit style guidance without learning the structured
  system first
- Confirmed terms are easy to scan and maintain
- UI works in both EN and KR

#### 6. Tests and Verification

**Checklist**:
1. Add schema tests for glossary entry validation
2. Add application tests for CRUD/import/versioning rules
3. Add prompt-rendering tests for deterministic output
4. Add route tests for invalid payloads and successful edits
5. Run:
   - `pnpm test`
   - `pnpm typecheck`
   - `pnpm lint`

**Recommended test cases**:
- creating duplicate `(novel_id, term_ja, category)` entries
- confirming a suggested entry bumps `glossary_version`
- editing only rejected metadata does not bump `glossary_version`
- deleting a confirmed entry updates prompt rendering
- importing mixed new/existing rows behaves predictably

**Definition of done for V3.1**:
- structured glossary schema is live
- existing style guide data is preserved
- translation prompt uses confirmed structured terms
- UI supports manual glossary curation
- tests cover versioning and prompt rendering behavior

### Recommended First PR Split

To keep review manageable, V3.1 should ideally be split into 3 PRs:

1. **PR 1: groundwork + schema**
   - `glossary_version`
   - `prompt_fingerprint`
   - `novel_glossary_entries`
   - base types/tests
2. **PR 2: application + API**
   - CRUD/import functions
   - route handlers
   - versioning rules
3. **PR 3: prompt integration + UI**
   - prompt rendering
   - glossary editor replacement
   - i18n strings
   - end-to-end manual verification
