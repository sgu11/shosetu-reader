# Data model

## Schema state (post-migration)

### `novels`

```sql
CREATE TABLE novels (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_site                 source_site NOT NULL DEFAULT 'syosetu',
  source_id                   text NOT NULL,        -- renamed from source_ncode
  source_url                  text NOT NULL,
  title_ja                    text NOT NULL,
  title_normalized            text,
  title_ko                    text,
  author_name                 text,
  author_id                   text,
  summary_ja                  text,
  summary_ko                  text,
  is_completed                boolean,
  status_raw                  text,
  total_episodes              integer,
  ranking_snapshot_json       jsonb,
  source_metadata_json        jsonb,
  last_source_sync_at         timestamptz,
  glossary_last_refreshed_at  timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT novels_site_id_unique UNIQUE (source_site, source_id)
);
```

`source_site` enum: `syosetu | nocturne | kakuyomu | alphapolis`.

### `episodes`

Already had `source_episode_id text` with `UNIQUE (novel_id, source_episode_id)` — zero migration on the episode side. Adapters populate it from `TocEntry.sourceEpisodeId`.

### `reader_preferences`

```sql
ALTER TABLE reader_preferences
  ADD COLUMN adult_content_enabled boolean NOT NULL DEFAULT true;
```

Per-profile flag. Default `true` is the user's decision A. Anonymous callers
(no active profile cookie) bypass the column entirely and always see SFW.

## ID encoding per site

| Site | Canonical `source_id` | Example |
|---|---|---|
| `syosetu` | ncode (`n[0-9]+[a-z]+`) | `n9669bk` |
| `nocturne` | ncode (separate namespace from syosetu) | `n5555aa` |
| `kakuyomu` | 19-digit numeric work id | `822139845727270228` |
| `alphapolis` | composite `{authorId}/{novelId}` | `101715426/813048051` |

The `(source_site, source_id)` composite unique resolves nocturne/syosetu
ncode collisions — the same string can legitimately exist in both
namespaces; the row is keyed by the pair.

## Episode IDs

| Site | `episodes.source_episode_id` | Source URL |
|---|---|---|
| `syosetu`/`nocturne` | `String(episodeNumber)` (ordinal) | `…/{ncode}/{N}/` |
| `kakuyomu` | opaque 19-digit episode id | `…/works/{id}/episodes/{episodeId}` |
| `alphapolis` | `String(episodeNo)` from `app-cover-data` JSON | `…/novel/{a}/{n}/episode/{N}` |

The ordinal `episodeNumber` is always 1-based within the novel and is the
basis for reader navigation. `sourceEpisodeId` is the value that flows into
the upstream URL builder.

## Migration files

### `drizzle/0024_source_enum_rename_adult_flag.sql`

In-transaction. Adds enum values + renames column + adds `adult_content_enabled`. PG14+ allows `ADD VALUE IF NOT EXISTS` inside a tx as long as the new value is not used in the same tx (which we don't).

```sql
ALTER TYPE source_site ADD VALUE IF NOT EXISTS 'nocturne';
ALTER TYPE source_site ADD VALUE IF NOT EXISTS 'kakuyomu';
ALTER TYPE source_site ADD VALUE IF NOT EXISTS 'alphapolis';

ALTER TABLE novels RENAME COLUMN source_ncode TO source_id;
ALTER TABLE novels RENAME CONSTRAINT novels_source_ncode_unique TO novels_source_id_unique;

ALTER TABLE reader_preferences
  ADD COLUMN adult_content_enabled boolean NOT NULL DEFAULT true;
```

`RENAME COLUMN` does **not** auto-rename dependent constraints, so the
`RENAME CONSTRAINT` is required to keep names tidy.

### `drizzle/0025_source_composite_unique_concurrent.sql`

**Outside transaction** (uses the `-- migrate:no-transaction` directive
parsed by `migrate.mjs`). Swaps the unique constraint without a write-blocking
lock window:

```sql
-- migrate:no-transaction

CREATE UNIQUE INDEX CONCURRENTLY novels_site_id_unique_idx
  ON novels (source_site, source_id);

ALTER TABLE novels ADD CONSTRAINT novels_site_id_unique
  UNIQUE USING INDEX novels_site_id_unique_idx;

ALTER TABLE novels DROP CONSTRAINT novels_source_id_unique;
```

The `USING INDEX` step is fast and lock-light because the index is already
built. The old constraint stays valid until immediately before the drop, so
there's no window where a duplicate `(source_site, source_id)` could be
inserted.

Reviewer-driven; the original v1 plan would have run a single
`DROP/ADD CONSTRAINT` pair which (a) takes ACCESS EXCLUSIVE on the live
`novels` table for the duration of the rebuild, and (b) opens a
dupe-insertion window between the two statements.

## migrate.mjs no-transaction support

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction — Postgres hard
restriction. Drizzle wraps every migration in `sql.begin(...)` by default.
Workaround: a header directive that switches the file to one-statement-at-a-time
mode without an outer tx.

```js
const noTransaction = /^[ \t]*--[ \t]*migrate:no-transaction[ \t]*$/m.test(content);

if (noTransaction) {
  for (const stmt of statements) await sql.unsafe(stmt);
  await sql`INSERT INTO ${sql(MIGRATIONS_TABLE)} (hash, created_at) VALUES (${entry.tag}, ${entry.when})`;
} else {
  await sql.begin(async (tx) => {
    for (const stmt of statements) await tx.unsafe(stmt);
    await tx`INSERT INTO ${tx(MIGRATIONS_TABLE)} (hash, created_at) VALUES (${entry.tag}, ${entry.when})`;
  });
}
```

This is a per-runner addition; the directive is opt-in and ignored by every
non-CONCURRENTLY migration. Audit log says "no-transaction" in the line so
operators see the difference.

## Postgres versions

- Local dev harness: PG17.
- Aries (production): PG16-alpine (`docker-compose.yml:3`).

Both honor `ADD VALUE IF NOT EXISTS` in-transaction without using the value,
and both honor `CREATE INDEX CONCURRENTLY` outside-transaction. Migrations
verified in dev before deploy.
