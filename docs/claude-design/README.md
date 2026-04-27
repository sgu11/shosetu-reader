# Multi-source novel adapter — design notes

Reference for the multi-source ingestion / ranking / register / read flow that
landed in V5. The reader started as syosetu-only; it now serves four sites
behind a single adapter abstraction.

| Site | Code | Adult | Periods | Notes |
|---|---|---|---|---|
| Syosetu | `syosetu` | no | daily / weekly / monthly / quarterly | JSON API |
| Nocturne | `nocturne` | yes | daily / weekly / monthly / quarterly | JSON API + `over18=yes` cookie |
| Kakuyomu | `kakuyomu` | no (per-work flag) | daily / weekly / monthly / yearly / entire | Scrape `__NEXT_DATA__` Apollo state |
| AlphaPolis | `alphapolis` | no (per-work flag) | hot only (top 20) | HTML scrape, two-step body fetch with CSRF |

Plan file: `/Users/sangeun/.claude/plans/a-adult-mode-as-serialized-dusk.md`.

## Index

| File | What |
|---|---|
| `01-overview.md` | Goals, decisions, phasing |
| `02-architecture.md` | `SourceAdapter` interface, registry, rate-limit decorator, types |
| `03-data-model.md` | Schema migrations, ID encoding per site |
| `04-adapters.md` | Per-site implementation notes |
| `05-api-and-caching.md` | `/api/ranking` scope param, cache classes, adult gate |
| `06-ui.md` | Ranking page, source pill, settings toggle (with screenshots) |
| `07-testing-and-canary.md` | Fixture tests, live-fetch canary cron, ops |
| `08-known-gotchas.md` | Per-site quirks + lessons learned during the migration |

## Quick map of the code

```
src/modules/source/
├── domain/
│   ├── source-adapter.ts    # Interface + types (SourceSite, RankingPeriod, NovelMetadata, …)
│   └── ncode.ts             # Syosetu ncode parsing/url helpers (kept for legacy callers)
├── infra/
│   ├── registry.ts          # getAdapter(), parseInput() — bare adapters; no global bucket (see 08-known-gotchas.md)
│   ├── syosetu-family.ts    # Factory shared by syosetu + nocturne
│   ├── syosetu-adapter.ts   # syosetuAdapter = createSyosetuFamilyAdapter({ general })
│   ├── nocturne-adapter.ts  # nocturneAdapter = createSyosetuFamilyAdapter({ adult })
│   ├── syosetu-api.ts       # Low-level JSON API client (now config-injectable)
│   ├── episode-scraper.ts   # Low-level HTML scraper (now config-injectable)
│   ├── kakuyomu-adapter.ts  # __NEXT_DATA__ + episode body + ranking
│   ├── kakuyomu-apollo.ts   # Tolerant Zod parser for __APOLLO_STATE__
│   ├── alphapolis-adapter.ts # 2-step CSRF body fetch + composite ID
│   └── alphapolis-body-parser.ts # <br><br> paragraph splitter, ruby <rt> stripper
└── api/schemas.ts           # registerNovelInputSchema → parseInput

src/modules/catalog/application/
├── adult-filter.ts          # filterAdultContent(items, ctx)
├── adult-context.ts         # resolveAdultContext(userId)
├── get-ranking.ts           # Legacy single-site getRanking (syosetu)
├── get-ranking-sections.ts  # Multi-source fan-out with per-section timeout
├── register-novel.ts        # Dispatches via getAdapter(site)
├── refresh-metadata.ts      # Dispatches via getAdapter(site)
└── ingest-episodes.ts       # Dispatches via getAdapter(site)

src/components/
├── source-pill.tsx          # SourcePill site badge component
└── ranking/
    ├── ranking-hero.tsx     # Top-rank card with SourcePill
    └── ranking-row.tsx      # List row with SourcePill

src/app/
├── api/ranking/route.ts     # ?scope=sfw|all|<site>
├── api/settings/route.ts    # GET/PUT incl. adultContentEnabled
├── ranking/page.tsx         # Source tabs + grouped sections
└── settings/page.tsx        # Reading section incl. adult toggle

scripts/canary-source-fetch.ts # Live-fetch drift detection (pnpm canary)

drizzle/
├── 0024_source_enum_rename_adult_flag.sql
└── 0025_source_composite_unique_concurrent.sql

migrate.mjs                  # Now supports `-- migrate:no-transaction`
```

## TL;DR

- Add a source: implement `SourceAdapter`, register in `registry.ts`, ship
  fixture tests, add canary probe, optionally extend `parseInput` priority.
- Add a feature that needs the source: depend on the **registry**, not
  individual adapter modules. Use `getAdapter(novel.sourceSite)` from a row,
  or `parseInput(userInput)` from a register form.
- Adult filtering: always go through `filterAdultContent(items, ctx)` at the
  application layer. Anonymous (no profile) → SFW only.
