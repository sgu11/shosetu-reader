# Shosetu Reader

A modular-monolith reading platform for Japanese web novels from
[Syosetu](https://syosetu.com/) with JP→KR translation. The app combines
Next.js, PostgreSQL, Redis-backed background jobs, and OpenRouter for a
translation-first reading experience.

## Current Status

- V1-V4 are implemented and summarized in [docs/progress.md](docs/progress.md).
- V4 hardening, performance, and cost-control work shipped on 2026-04-14.
- V5 is the active planning track for new capabilities such as quality warning
  surfaces, selective re-ingest, reading stats, SSE, offline support, and EPUB
  export.

## Features

- **Novel registration** via Syosetu URL or ncode
- **Episode ingestion** with batch ingest, full ingest, and full re-ingest background jobs
- **Web reader** with JA/KR toggle, per-device font/layout preferences, scroll restoration
- **Translation pipeline** via OpenRouter with model selection, retry, re-translate, discard, and session abort
- **V3 translation engine** with structured glossary, context chaining across episodes, adaptive chunking, and quality validation
- **Live episode updates** for ingestion and translation progress
- **Translation inventory** with per-model breakdown and novel/episode-level discard
- **Multi-user profiles** with guest data migration and user-scoped settings, library, and progress
- **Personal library** with subscriptions, progress tracking, continue-reading, and status overview
- **Ranking discovery** from Syosetu (daily/weekly/monthly/quarterly)
- **Bilingual UI** (English/Korean) with cookie-based locale persistence
- **Per-novel glossary & style guide** with auto-extraction from translated episodes
- **Cost tracking** across translation, glossary generation, term extraction, and session rollups
- **Cost budget controls** that can auto-pause translation sessions when spend crosses a configured threshold
- **Operational APIs** for job health, queue metrics, translation quality, and model throughput
- **Dark/light/system theme** with a Supabase-inspired design system

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 (dark-mode-native)
- **Database**: Drizzle ORM + PostgreSQL
- **Queue**: Redis-backed durable job queue with a dedicated worker
- **Translation**: OpenRouter (OpenAI-compatible) for JP→KR
- **Validation**: Zod
- **Testing**: Vitest + Playwright smoke coverage
- **Deployment**: Docker Compose
- **Package manager**: pnpm

## Quick Start (Local)

```bash
cp .env.example .env    # fill in DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY
pnpm install
pnpm db:migrate
pnpm dev                # app on http://localhost:3000
pnpm worker             # background jobs
```

Local development expects PostgreSQL and Redis to be running on `localhost`
with values that match `.env`. Async ingest and translation flows require the
worker process.

## Production (Docker)

```bash
cp .env.example .env.production   # fill in secrets
docker compose up -d --build      # app + worker + db + redis on port 3000
```

Migrations run automatically on container start.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm worker` | Start the background job worker |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm check` | Run lint + typecheck |
| `pnpm test` | Run Vitest |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm dev:verify` | Run `check`, `test`, and `build` together |
| `pnpm dev:smoke` | Hit core HTTP smoke endpoints against a running app |
| `pnpm test:browser` | Run Playwright browser smoke tests |
| `pnpm dev:loop` | Run the full local verification loop |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Project Structure

```text
src/
  app/              Next.js App Router pages and API routes
  components/       Shared React components
  features/         Reserved for cross-cutting UI feature slices (currently empty)
  lib/              Shared infrastructure (db, i18n, auth, rate-limit, cache, redis)
  modules/          Domain modules (modular monolith)
    source/         Syosetu API/HTML integration
    catalog/        Novel and episode domain
    library/        Subscriptions, progress, continue-reading
    translation/    Translation pipeline (OpenRouter)
    reader/         Reader content assembly
    identity/       Users, sessions, preferences
    jobs/           Background job orchestration (Redis queue + worker runtime)
    admin/          Ops visibility
  styles/           Shared Tailwind and CSS assets
tests/              Vitest and Playwright coverage
drizzle/            SQL migration files
docs/               Architecture, design, verification, and planning documents
```

## API Overview

| Area | Endpoints |
|------|-----------|
| **Discovery** | `POST /api/novels/register`, `GET /api/ranking`, `POST /api/ranking/translate-titles` |
| **Novel & Episodes** | `GET /api/novels/[id]`, `GET .../episodes`, `POST .../ingest`, `POST .../ingest-all`, `POST .../reingest-all`, `GET .../live-status` |
| **Translation** | `POST .../bulk-translate`, `POST .../bulk-translate-all`, `POST .../translate-session/abort`, `DELETE /api/novels/[id]/translations/discard` |
| **Per-episode** | `POST .../request`, `GET .../status`, `DELETE .../discard` |
| **Glossary** | `GET/PUT/POST .../glossary`, `GET/POST .../entries`, `PUT/DELETE .../entries/[id]`, `POST .../entries/import` |
| **Library** | `GET /api/library`, `POST/DELETE .../subscribe`, `PUT /api/progress` |
| **Identity** | `POST /api/auth/sign-in`, `POST .../sign-out`, `GET .../session`, `GET/POST /api/profiles`, `GET/PUT/DELETE .../active` |
| **Reader & Settings** | `GET /api/reader/episodes/[id]`, `GET/PUT /api/settings`, `GET/PUT /api/translation-settings`, `GET /api/openrouter/models` |
| **Admin** | `GET /api/health`, `GET .../jobs`, `GET .../metrics`, `GET/POST .../scheduled`, `GET .../translations`, `GET .../translations/quality`, `GET .../translations/trends` |
| **Jobs** | `GET /api/jobs/[id]`, `GET /api/novels/[id]/jobs/current` |

## Pages

| Page | Description |
|------|-------------|
| Home | Hero + continue reading |
| Library | Subscribed novels with status badges and new-episode visibility |
| Ranking | Daily/weekly/monthly/quarterly Syosetu discovery |
| Register | URL or ncode input |
| Novel detail | Episode list with live updates, glossary editor, translation inventory, and bulk actions |
| Reader | JA/KR toggle, model switching, font settings, progress tracking |
| Settings | Locale, theme, translation model, and global prompt defaults |
| Profiles | Create, switch, and migrate guest data |
| Sign-in | Lightweight identity entry point |

## Documentation

See [`docs/`](docs/) for architecture and planning details:

- [V1 Goal](docs/v1-goal.md) — product requirements and acceptance criteria
- [V1 Architecture](docs/v1-architecture.md) — system design
- [V1 Design](docs/v1-design.md) — UX and interaction patterns
- [V1 Design Style](docs/v1-design-style.md) — Supabase-inspired visual system
- [V2 Architecture](docs/v2-architecture.md) — multi-user, durable jobs, live updates
- [V3 Architecture](docs/v3-architecture.md) — glossary, context chaining, quality validation
- [V3 Review](docs/v3-review.md) — post-implementation review and follow-on gaps
- [V4 Plan](docs/v4-plan.md) — hardening, performance, and cost-control work
- [V5 Plan](docs/v5-plan.md) — new capability roadmap
- [Dev Loop Harness](docs/dev-loop-harness.md) — local verification and smoke-test workflow
- [Progress](docs/progress.md) — current implementation status across all phases

## License

[MIT](LICENSE)
