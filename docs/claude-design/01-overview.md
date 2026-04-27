# Overview

## Why

The reader was syosetu-only. Two consequences:

1. Source-specific code (`syosetu-api.ts`, `episode-scraper.ts`, `domain/ncode.ts`)
   was imported directly by every caller — `register-novel`, `ingest-episodes`,
   `refresh-metadata`, `get-ranking`, plus two API route handlers. Adding a
   second site meant either duplicating that fan-out or building an abstraction.
2. The `novels.source_site` enum existed but only had one value, and the
   `source_ncode` column name embedded a syosetu-specific assumption.

Multi-source support was needed for kakuyomu (no JSON API, requires HTML +
Apollo-state scraping), nocturne (R-18 sister site of syosetu requiring an
age-gate cookie), and alphapolis (composite IDs + anti-scraping flow).

## Decisions made before coding

Three independent reviews (correctness, architecture, fact-check) shaped the
final plan; full details in `08-known-gotchas.md`. The load-bearing decisions:

| # | Decision | Reason |
|---|---|---|
| A | Adult mode default **on** for authenticated profiles, **always SFW** for anonymous | Plan A from user; anonymous gating prevents R-18 leak through public CDN cache |
| B | AlphaPolis exposes `hot` ranking only, top 20 | User decision B; alphapolis ranking categories are complex and v1 only needs one |
| C | Combined "All" view is **grouped by source**, not interleaved | User decision C; per-site sections give users control over which feed they trust |
| D | Fixture-based tests + scheduled live-fetch **canary** | User decision D + reviewer push: fixtures catch parser regressions, canary catches upstream drift |
| — | Rename `source_ncode` → `source_id` now | Plan agent: composite alphapolis ids would make `ncode` actively misleading |
| — | Migration B uses `CREATE INDEX CONCURRENTLY` + `ADD CONSTRAINT USING INDEX` | Reviewer: avoid ACCESS EXCLUSIVE lock window + dupe insertion gap |
| — | Rate-limit at registry decorator, not per-call | Reviewer: API routes were hitting upstreams un-throttled in concurrent paths |
| — | Cache classes: anonymous-SFW (`public, s-maxage=300, swr=1800`) + authenticated (`private, max-age=60, swr=300, Vary: Cookie`); no anonymous-`all` route | Reviewer: simpler cache fragmentation, anonymous always SFW so no leak |
| — | EPUB URN keeps syosetu byte-identical, others URL-encoded | Reviewer: preserves EPUB-reader progress identity for legacy exports |

## Phasing

Each phase shipped to aries via `git push origin main` → `ssh aries pull && docker compose build app worker && up -d`. Migrations apply at container start via `migrate.mjs`.

| # | Phase | What |
|---|---|---|
| 1 | Schema | Enum +3 values, column rename, composite unique (concurrent), `adult_content_enabled` flag |
| 2 | Adapter abstraction | `SourceAdapter` interface, registry, `RateLimitedAdapter` decorator, syosetu wrapped behind it |
| 3 | Nocturne | `syosetuFamilyAdapter` factory, novel18 base + `over18` cookie, shared host bucket |
| 4 | Kakuyomu | `__APOLLO_STATE__` tolerant Zod parser, episode body scrape, ranking page scrape |
| 5 | AlphaPolis | Composite IDs, 2-step body fetch (token + CSRF + cookie), `<br><br>` paragraph splitter, ruby stripping |
| 6 (backend) | Catalog backend | `getRankingSections` fan-out + timeout + adult filter, `/api/ranking?scope=`, EPUB URN |
| 6b (UI) | Ranking UI | Source tab strip, grouped sections, `SourcePill` component, adult toggle in settings, i18n |
| 7 | Canary | `scripts/canary-source-fetch.ts` + `pnpm canary`, scheduled drift detection |

Phases 3–5 were declared independent and parallelizable after phase 2 lands;
they were shipped sequentially in this run for review-friendliness but could
have run in parallel.
