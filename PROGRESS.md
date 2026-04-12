# PROGRESS.md

Last updated: 2026-04-10

---

## Implementation Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation (Next.js, DB, env, logging) | Done |
| 1 | Data Model and Core Contracts | Done |
| 2 | Source Registration Foundation | Done |
| 3 | Episode Ingestion and Reader Baseline | Done |
| 3.5 | Design System Integration (dark-mode-native) | Done |
| 4 | Library and Progress | Done |
| 5 | Translation Pipeline | Done |
| 6 | Ranking Discovery | Done |
| 7 | Hardening and Docker | Done |

---

## Acceptance Criteria (goal.md §7)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Register novel via URL or ncode | Done | POST /api/novels/register |
| Read ingested Japanese episodes | Done | Reader with Noto Serif JP, prev/next nav |
| Subscriptions and continue-reading | Done | Subscribe/unsubscribe, progress auto-save |
| Korean translation request and read | Done | OpenRouter provider, fire-and-forget async |
| UI supports English and Korean | Done | EN/KR dictionaries, locale switcher in nav, cookie-based persistence |
| System runs with PostgreSQL and Redis, Docker-ready | Partial | PostgreSQL + Docker done, DB migration in entrypoint, Redis deferred |

---

## Feature Gap Analysis

### 1. i18n — UI Localization (EN/KR) — DONE
- EN/KR translation dictionaries in `src/lib/i18n/dictionaries.ts`
- `LocaleProvider` context + `useTranslation()` hook for client components
- Server-side `getLocale()` + `t()` for server components
- `LocaleSwitcher` pill in nav bar, cookie-based locale persistence
- All UI strings extracted across 7 pages and 5 components

### 2. Reader Settings UI — DONE
- `ReaderSettings` dropdown panel in reader header (font size, line height, content width)
- Settings applied via CSS custom properties (`--reader-font-size`, `--reader-line-height`, `--reader-content-width`)
- Auto-persisted to DB via Settings API

### 3. Settings API — DONE
- `GET /api/settings` — returns user locale, theme, and reader preferences
- `PUT /api/settings` — updates user preferences and reader preferences (upsert)

### 4. DB Migration in Docker — DONE
- `docker-entrypoint.sh` runs `drizzle-kit migrate` before starting server
- Dockerfile copies migration files and drizzle-kit to production image
- `.dockerignore` updated to include `drizzle/` directory

### 5. Redis Integration — Deferred
- **Required by:** goal.md §5, architecture.md §5.4/§5.6
- Fire-and-forget async translation works for v1
- Redis + BullMQ planned for post-v1 reliability improvements

---

## What's Built

### API Routes (16 endpoints)
- `GET  /api/health`
- `POST /api/novels/register`
- `GET  /api/novels/[novelId]`
- `GET  /api/novels/[novelId]/episodes`
- `POST /api/novels/[novelId]/ingest`
- `GET  /api/reader/episodes/[episodeId]`
- `POST /api/library/[novelId]/subscribe`
- `DELETE /api/library/[novelId]/subscribe`
- `GET  /api/library`
- `PUT  /api/progress`
- `POST /api/translations/episodes/[episodeId]/request`
- `GET  /api/translations/episodes/[episodeId]/status`
- `GET  /api/ranking`
- `GET  /api/settings`
- `PUT  /api/settings`
- `GET  /api/admin/jobs`
- `GET  /api/admin/translations`

### Pages (7 screens)
- Home (hero + continue reading)
- Register novel
- Novel detail (episodes list, subscribe, ingest)
- Reader (JA/KR toggle, progress tracker, prev/next nav, reader settings)
- Library
- Ranking (daily/weekly/monthly/quarter tabs)

### Modules (8 domains)
- source, catalog, library, translation, reader — implemented
- identity, jobs, admin — skeleton/placeholder

### Tests
- 41 tests across 6 files, all passing
- Coverage: ncode parsing, input schemas, episode scraping, Syosetu API, library schemas, translation schemas

---

## Remaining Items (Post-v1)
1. **Redis integration** — BullMQ job queue for translation reliability
2. **Auth** — Replace default anonymous user with real authentication (NextAuth)
3. **Scheduled jobs** — Periodic ranking sync, metadata refresh
4. **Metrics** — Translation cost tracking, queue depth monitoring
