# IMPLEMENTATION_PLAN.md

## 1. Objective

Build the first deployable version as a modular monolith focused on the core loop: register, subscribe, read, resume, and translate.

---

## 2. Recommended Stack

- Next.js with TypeScript
- PostgreSQL
- Redis
- Prisma or Drizzle
- BullMQ or equivalent Redis-backed jobs
- Zod for validation
- Cheerio for episode parsing
- Tailwind CSS for design tokens and layout discipline

---

## 3. Initial Repository Structure

```text
src/
  app/
  modules/
    source/
    catalog/
    library/
    translation/
    reader/
    identity/
    jobs/
    admin/
  lib/
    db/
    queue/
    cache/
    logger/
    i18n/
  components/
  features/
  styles/
```

Inside each module, separate:
- `domain`
- `application`
- `infra`
- `api`

---

## 4. Phase Plan

### Phase 0. Foundation
- initialize Next.js + TypeScript app
- configure linting, formatting, env validation, and logging
- add PostgreSQL and Redis local setup
- create database migration workflow

Deliverable:
- app boots locally with health check and typed configuration

### Phase 1. Data Model and Core Contracts
- implement schema for `users`, `novels`, `episodes`, `subscriptions`, `reading_progress`, `reader_preferences`, and `translations`
- define shared enums for fetch status, translation status, locale, theme, and reader language
- write Zod schemas for registration input and core API responses

Deliverable:
- stable database schema and typed domain contracts

### Phase 2. Source Registration Foundation
- implement `ncode` and URL parser with strict Syosetu validation
- build source clients for ranking and novel metadata APIs
- upsert normalized novel records
- create `POST /api/novels/register`
- create novel detail shell page

Deliverable:
- a user can register a novel and view normalized metadata

### Phase 3. Episode Ingestion and Reader Baseline
- build episode fetcher and parser using HTML retrieval plus normalization
- persist raw checksum, source URL, raw text, and normalized text
- create fetch jobs and retry policy
- build `GET /api/reader/episodes/:episodeId`
- implement minimal reader UI for Japanese reading

Deliverable:
- source episodes are readable in a stable web reader

### Phase 3.5. Design System Integration
- adopt dark-mode-native design tokens from DESIGN_STYLE.md (Supabase-inspired)
- replace warm cream/brown palette with near-black backgrounds and emerald green accents
- switch UI font to Inter (geometric sans-serif as Circular substitute)
- add Source Code Pro for monospace technical labels
- implement border-defined depth hierarchy (no shadows)
- use pill buttons (9999px radius) for primary CTAs
- apply weight 400 as default, 500 only for interactive elements
- refactor all existing pages and components to match design system

Deliverable:
- consistent dark-mode-native UI across all screens following DESIGN_STYLE.md

### Phase 4. Library and Progress
- implement subscribe and unsubscribe endpoints
- build library query and continue-reading logic
- implement automatic progress persistence with current language and scroll anchor
- add Home and Library screens

Deliverable:
- personal library and resume flow work end to end

### Phase 5. Translation Pipeline
- define provider abstraction and OpenRouter-backed implementation
- compute translation identity from episode, provider, model, prompt version, and source checksum
- implement translation job orchestration and status endpoint
- render Korean mode in reader with graceful pending and failed states

Deliverable:
- Korean translation is queued, cached, surfaced, and readable

### Phase 6. Ranking Discovery
- sync ranking snapshots on schedule
- build ranking list endpoint and screen
- allow subscribe/register directly from ranking items

Deliverable:
- discovery loop is complete

### Phase 7. Hardening and Deployment
- add structured logging and basic metrics
- expose admin-visible job failure information
- add Dockerfile and `docker-compose.yml`
- verify production-safe config and migration flow

Deliverable:
- reproducible local stack and deployable baseline

---

## 5. API Surface to Build First

- `POST /api/novels/register`
- `GET /api/novels/:novelId`
- `GET /api/novels/:novelId/episodes`
- `GET /api/reader/episodes/:episodeId`
- `POST /api/library/:novelId/subscribe`
- `DELETE /api/library/:novelId/subscribe`
- `GET /api/library`
- `PUT /api/progress/:novelId`
- `POST /api/translations/episodes/:episodeId/request`
- `GET /api/translations/episodes/:episodeId/status`

---

## 6. Cross-Cutting Rules

- do not scrape metadata that the official API already provides
- never render upstream HTML directly
- never make translation a synchronous dependency for reading
- persist stable IDs and checksums for repairable pipelines
- keep UI language separate from content language
- return screen-shaped payloads for reader and library views

---

## 7. Order of Implementation

1. foundation and schema
2. registration and metadata sync
3. episode ingestion and reader payload
3.5. design system integration (dark-mode-native, Supabase-inspired)
4. library and progress
5. translation pipeline
6. ranking discovery
7. hardening and Docker

This order keeps the highest-risk backend flows early while preserving a usable product at each milestone.

---

## 8. Exit Criteria

Implementation planning is complete when:
- the stack and directory structure are fixed
- the first schema and API contracts are agreed
- milestones map cleanly to working user flows
- async jobs, caching, and observability are accounted for from the start

---

END
