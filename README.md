# Shosetu Reader

A web reading platform for Japanese web novels from [Syosetu](https://syosetu.com/) with JP→KR translation. Built as a modular monolith with Next.js, PostgreSQL, Redis, and OpenRouter.

## Features

- **Novel registration** via Syosetu URL or ncode
- **Episode ingestion** with batch and full-ingest background jobs
- **Web reader** with JA/KR toggle, per-device font/layout preferences, scroll restoration
- **Translation pipeline** via OpenRouter with model selection, retry, re-translate, discard, and session abort
- **V3 translation engine** with structured glossary, context chaining across episodes, adaptive chunking, and quality validation
- **Live episode updates** — translation and ingestion progress update without page reload
- **Translation inventory** with per-model breakdown and novel/episode-level discard
- **Multi-user profiles** with guest data migration and user-scoped settings/library/progress
- **Personal library** with subscriptions, progress tracking, continue-reading, and status overview
- **Ranking discovery** from Syosetu (daily/weekly/monthly/quarterly)
- **Bilingual UI** (English/Korean) with cookie-based locale persistence
- **Per-novel glossary & style guide** with auto-extraction from translated episodes
- **Cost tracking** across all pipeline stages (translation, glossary generation, term extraction)
- **Dark/light/system theme** with Supabase-inspired design system

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4 (dark-mode-native)
- **Database**: Drizzle ORM + PostgreSQL
- **Queue**: Redis-backed durable job queue with dedicated worker
- **Translation**: OpenRouter (OpenAI-compatible) for JP→KR
- **Validation**: Zod
- **Testing**: Vitest (56 tests)
- **Deployment**: Docker Compose
- **Package manager**: pnpm

## Quick Start

```bash
cp .env.example .env    # fill in DATABASE_URL and OPENROUTER_API_KEY
pnpm install
pnpm db:migrate
pnpm dev                # http://localhost:3000
```

## Production (Docker)

```bash
cp .env.example .env.production   # fill in secrets
docker compose up -d --build      # app + worker + db + redis on port 3000
```

Migrations run automatically on container start.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm check` | Lint + typecheck |
| `pnpm test` | Run vitest |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Project Structure

```
src/
  app/              Next.js App Router pages and API routes
  components/       React components (18)
  lib/              Shared infrastructure (db, i18n, auth, rate-limit)
  modules/          Domain modules (modular monolith)
    source/         Syosetu API/HTML integration
    catalog/        Novel and episode domain
    library/        Subscriptions, progress, continue-reading
    translation/    Translation pipeline (OpenRouter)
    reader/         Reader content assembly
    identity/       Users, sessions, preferences
    jobs/           Background job orchestration (Redis queue + worker)
    admin/          Ops visibility
tests/              Vitest tests mirroring src/ structure
drizzle/            SQL migration files (17 migrations)
docs/               Architecture, design, and planning documents
```

## API (39 route files)

| Area | Endpoints |
|------|-----------|
| **Discovery** | `POST /api/novels/register`, `GET /api/ranking`, `POST /api/ranking/translate-titles` |
| **Novel & Episodes** | `GET /api/novels/[id]`, `GET .../episodes`, `POST .../ingest`, `POST .../ingest-all` |
| **Translation** | `POST .../bulk-translate`, `POST .../bulk-translate-all`, `POST .../translate-session/abort` |
| **Per-episode** | `POST .../request`, `GET .../status`, `DELETE .../discard` |
| **Glossary** | `GET/PUT .../glossary`, `GET/POST .../entries`, `PUT/DELETE .../entries/[id]`, `POST .../entries/import` |
| **Library** | `GET /api/library`, `POST/DELETE .../subscribe`, `PUT /api/progress` |
| **Identity** | `POST /api/auth/sign-in`, `POST .../sign-out`, `GET .../session`, `GET/POST /api/profiles`, `GET/PUT/DELETE .../active` |
| **Reader & Settings** | `GET /api/reader/episodes/[id]`, `GET/PUT /api/settings`, `GET/PUT /api/translation-settings`, `GET /api/openrouter/models` |
| **Admin** | `GET /api/health`, `GET .../jobs`, `GET .../metrics`, `GET .../scheduled`, `GET .../translations`, `.../quality`, `.../trends` |
| **Jobs** | `GET /api/jobs/[id]`, `GET .../novels/[id]/jobs/current` |

## Pages

| Page | Description |
|------|-------------|
| Home | Hero + continue reading |
| Library | Subscribed novels with status badges |
| Ranking | Daily/weekly/monthly/quarterly from Syosetu |
| Register | URL or ncode input |
| Novel detail | Episode list with live updates, glossary editor, translation inventory, actions menu |
| Reader | JA/KR toggle, model switching, font settings, progress tracking |
| Settings | Locale, theme, translation model, global prompt |
| Profiles | Create, switch, guest data migration |
| Sign-in | Authentication entry point |

## Documentation

See [`docs/`](docs/) for architecture and design documents:

- [V1 Goal](docs/v1-goal.md) — product requirements and acceptance criteria
- [V1 Architecture](docs/v1-architecture.md) — system design
- [V1 Design](docs/v1-design.md) — UX and interaction patterns
- [V1 Design Style](docs/v1-design-style.md) — Supabase-inspired visual system
- [V2 Architecture](docs/v2-architecture.md) — multi-user, durable jobs, live updates
- [V3 Architecture](docs/v3-architecture.md) — glossary, context chaining, quality validation
- [Progress](docs/progress.md) — implementation status across all phases

## License

[MIT](LICENSE)
