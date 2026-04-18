# Dev Loop Harness

Last updated: 2026-04-17

## Purpose

This document tracks the local verification loop for the current codebase. It
should answer two questions quickly:

1. Which commands define a healthy local iteration loop?
2. What should we test next as V5 work begins?

## Current Verification Baseline

- `.env.example` includes local `DATABASE_URL`, `REDIS_URL`, and OpenRouter model defaults.
- Async job flows require both `pnpm dev` and `pnpm worker`.
- `scripts/dev-smoke.mjs` exercises core HTTP health and profile/library paths.
- Playwright smoke coverage lives in `tests/browser/smoke.spec.ts`.

Latest verified checks for this doc refresh:

- `pnpm typecheck`
- `pnpm test` (`61` tests across `11` files)
- `pnpm build`

Current known issue:

- `pnpm test:browser` is not green in this environment right now. On
  2026-04-17, the Playwright-managed `pnpm dev` server emitted repeated startup
  warnings and all four smoke tests timed out on initial `page.goto(...)` with
  `net::ERR_ABORTED`.

## Harness Commands

- Start app: `pnpm dev`
- Start worker: `pnpm worker`
- Static + unit + build verification: `pnpm dev:verify`
- Runtime smoke checks against a running local server: `pnpm dev:smoke`
- Browser smoke checks with a managed local server: `pnpm test:browser`
- Full local iteration loop: `pnpm dev:loop`

If the app is not running on `http://localhost:3000`, set `APP_URL`:

```bash
APP_URL=http://localhost:3001 pnpm dev:smoke
```

## Smoke Coverage Today

### `pnpm dev:smoke`

- `GET /api/health`
- `GET /api/profiles/active`
- `GET /api/library`
- `GET /api/jobs/:missing-id` returns `404`

### `pnpm test:browser`

- Home, library, and profiles navigation renders
- Creating a profile updates the visible active-profile state
- Navigation stays usable on a small screen
- Profile creation shows friendly validation feedback

## Recommended Next Browser Expansions

- Novel detail live-status card updates cleanly while a job is running
- Reader keeps a readable KR translation mounted while a re-translation is in flight
- Quality warning badges appear when a translation has `quality_warnings`
- `hasNewEpisodes` badge clears correctly after visiting a novel detail page

## Current Loop Targets

### Target 1: V5.1 Quality Warnings Dashboard

Why first:
- The backend already stores `quality_warnings` and exposes admin APIs.
- It adds immediate user-visible value without requiring pipeline changes.

Acceptance:
- Novel detail shows aggregated warning counts.
- Episodes with warning/error states are visibly identifiable.
- Reader surfaces a non-intrusive warning when the displayed translation has issues.

### Target 2: V5.3 Selective Re-ingest

Why next:
- It reduces avoidable Syosetu traffic and shortens long-running maintenance jobs.
- It improves an existing costly workflow instead of introducing a brand-new subsystem.

Acceptance:
- `reingest-all` reports changed vs unchanged counts.
- Unchanged episodes are skipped when upstream metadata or checksums match.

### Target 3: V5.4 Reading Statistics

Why third:
- It is a low-risk user-facing feature built on existing data.
- It expands the product surface without destabilizing translation flows.

Acceptance:
- `/stats` (or equivalent) shows episodes read, streaks, and model/cost rollups.
- Queries stay bounded and use existing indexes or targeted new ones.

## Recommended Loop Cadence

For each slice:

1. Implement one focused change.
2. Run `pnpm typecheck`
3. Run `pnpm test`
4. Run `pnpm build`
5. Run `pnpm test:browser` when UI behavior changes, after the browser harness is stable again
6. Run `pnpm dev:smoke` when API or runtime wiring changes

## Suggested First Iteration

Start with V5.1:

1. Add a novel-detail warning summary fed by existing `quality_warnings`.
2. Add a small reader-level warning indicator for the selected translation.
3. Extend Playwright coverage to assert the warning surface appears when seeded data includes warnings.
