# Known gotchas + lessons

## Migration

### Drizzle wraps every migration in BEGIN/COMMIT

`migrate.mjs:64` runs `await sql.begin(async (tx) => { … })` per file. That
means **CREATE INDEX CONCURRENTLY cannot run via the default path** — PG
hard rejection. Solution: header directive on the SQL file:

```sql
-- migrate:no-transaction
CREATE UNIQUE INDEX CONCURRENTLY ...
```

`migrate.mjs` parses that on the first non-blank line and switches to
`sql.unsafe` per statement without an outer tx.

### PG enum ADD VALUE in a transaction

PG12+ allows `ADD VALUE IF NOT EXISTS` inside a transaction block as long as
the new value is **not used** in the same tx. Migration A relies on this:
the `ALTER TYPE … ADD VALUE` statements all sit alongside a column rename
and a column add, but no statement actually inserts a row using the new enum
values. PG16 (aries) + PG17 (local) both work.

If you ever need to USE the new value in the same migration, split it.

### RENAME COLUMN does not auto-rename dependent constraints

`ALTER TABLE novels RENAME COLUMN source_ncode TO source_id` leaves the
unique constraint named `novels_source_ncode_unique` — pointing at the
renamed column. Add an explicit `ALTER TABLE novels RENAME CONSTRAINT
novels_source_ncode_unique TO novels_source_id_unique` to keep names tidy.
(The composite swap migration drops it anyway, but the intermediate state
matters during deploy.)

### Constraint swap window

Naive: `DROP CONSTRAINT old; ADD CONSTRAINT new` opens a window between the
two statements where duplicate `(source_site, source_id)` rows could be
inserted by concurrent writers. Use:

```sql
CREATE UNIQUE INDEX CONCURRENTLY x ON novels (source_site, source_id);
ALTER TABLE novels ADD CONSTRAINT new UNIQUE USING INDEX x;  -- atomic, fast
ALTER TABLE novels DROP CONSTRAINT old;                       -- old still valid until here
```

The old constraint stays valid until the moment it's dropped, so there is
**no** dupe-insertion window.

## Adapter

### `parseId` ambiguity for syosetu vs nocturne

Both share the `n[0-9]+[a-z]+` regex. URL host (`ncode.syosetu.com` vs
`novel18.syosetu.com`) is the only signal. Nocturne adapter's `matchBareId`
returns null — bare ncode pastes always resolve to syosetu. Document this
in the register-page placeholder when i18n updates land.

### `TocEntry.sourceEpisodeId` vs `episodeNumber`

Pre-refactor: `ingest-episodes.ts:29` coerced `String(entry.episodeNumber)`
into `sourceEpisodeId` because every adapter at the time was syosetu-style
ordinal. Kakuyomu's opaque episode IDs broke that assumption. Adapters now
own the field and `ingest-episodes.ts` reads it directly.

If you add an adapter with ordinal episode numbers, populate
`sourceEpisodeId: String(episodeNumber)` in `fetchEpisodeList`.

### Rate limiting at registry, not call site

The original syosetu code had `FETCH_DELAY_MS = 1000` hard-coded inside
`ingest-episodes.ts` and a manual `setTimeout` after each fetch. That only
throttled the batch loop — concurrent ranking requests + register requests
hit upstreams in parallel. Reviewer fix: per-host token bucket on the
`RateLimitedAdapter` decorator inside the registry. Decorator wraps the four
`fetch*` methods so callers never think about delays.

### Kakuyomu Apollo schema drift

The Apollo cache shape can change at any time when kakuyomu redeploys their
Next.js bundle. Mitigations:

- Tolerant Zod schemas with `.passthrough()` and `.nullish()` on every
  non-required field. Only the 5–6 fields we read are required.
- Scheduled live-fetch canary (see `07-testing-and-canary.md`) catches drift
  within 24h.

If you find yourself adding a required field, ask whether you really need it
or whether `.nullish()` would do — fewer required fields = more durable
parser.

### AlphaPolis 419 errors

The `/novel/episode_body` endpoint returns HTTP 419 ("page expired") if any
of three things is missing: session cookie, CSRF token, or per-page body
token. Always run the full GET-then-POST flow. Don't try to cache the CSRF
token across episodes — Laravel rotates it per session and the body token
is per-page.

The token regex `'token': '([a-f0-9]{20,})'` is brittle but stable so far.
If alphapolis re-skins their loader, this will break loudly.

### AlphaPolis paragraph parsing

`<br><br>` for paragraph breaks, single `<br>` for line breaks within a
paragraph, ruby `<rt>` stripped (kana glosses) but base text retained.
Anything else (fancy paragraph breaks via CSS, `<div>` wrappers, etc.) would
need parser updates.

## Cache + auth

### Anonymous-vs-authenticated cache classes

Don't have an anonymous-`all` cache class. Anonymous always SFW. The
`?scope=all` path must require an active profile cookie, otherwise R-18
content can leak through public CDN cache.

If you add a third class (e.g., per-team), bump the cache key shape via
URL paths or `Vary` rather than fragmenting the existing classes.

### EPUB URN stability

`urn:shosetu:{ncode}:{ts}` — the `shosetu` literal stays for syosetu rows
**always**. Other sites get `urn:{site}:{encodeURIComponent(id)}:{ts}`. If
you change the URN scheme for syosetu, EPUB readers will treat re-exported
files as new books and lose user progress. The site-aware encoder in
`build-epub.ts` is intentional.

### AlphaPolis composite IDs in URN

`encodeURIComponent("101715426/813048051")` → `101715426%2F813048051`. The
URN is RFC-valid this way. Any future code path that uses `novel.sourceId`
to build URNs needs to apply the same encoding consistently — otherwise
`/` and `%2F` are different identifiers in EPUB readers.

## UI

### Source pill colors

Tailwind tokens used: `emerald` (syosetu), `rose` (nocturne — adult cue),
`sky` (kakuyomu), `amber` (alphapolis). All have light + dark variants
defined in the component. Don't change without updating the component
test once it exists.

### Period strip auto-correction

When the user changes scope, `useEffect` checks whether the current period
is in the new scope's supported list and auto-corrects to the first
supported period. This avoids the "period button highlighted but the API
silently swapped to a different period" UX bug.

### Translation cache and scope change

Selecting a different scope clears `titleKo` (the per-section title-KO map)
and re-fetches translations. The DB-backed title cache is still hit, so
warm titles render fast. New titles trigger an OpenRouter call.
