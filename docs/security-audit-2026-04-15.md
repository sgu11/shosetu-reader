# Security Audit Report: Shosetu-Reader

**Date:** 2026-04-15
**Reviewers:** Senior Software Engineer, Chief Security Officer, Penetration Tester
**Scope:** Full application, infrastructure, and attack surface review
**Branch:** `phase-0-1-2-foundation` (commit `cef72d1`)

---

## Executive Summary

Three independent security reviews identified **19 deduplicated findings** across the Shosetu-Reader application. The most critical issues center on the absence of real authentication and authorization: the email-only sign-in has no credential verification, most API endpoints have no auth checks, and profiles can be switched to any user without ownership validation. These issues make the application unsuitable for internet-facing deployment in its current state.

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 4     | Must fix before any public exposure |
| High     | 7     | Fix in hardening phase |
| Medium   | 6     | Fix in hardening phase or next iteration |
| Low      | 2     | Track and address opportunistically |

### Areas Confirmed Clean

- **SQL Injection:** Drizzle ORM properly parameterizes all queries. No raw string concatenation into SQL found.
- **XSS via Raw HTML Rendering:** No usage of React's raw HTML rendering APIs anywhere in the codebase. Novel content is rendered as text nodes, not raw HTML.
- **SSRF:** Ncode regex validation (`/^n[0-9]+[a-z]+$/`) + hardcoded Syosetu domain URLs prevent arbitrary URL fetching.
- **Session Token Forgery:** Uses `randomBytes(32)` (256-bit entropy) + SHA-256 hash before storage. Cryptographically sound.
- **Redis Command Injection:** All payloads JSON-serialized through ioredis structured API.
- **Admin Route Consistency:** All 5 `/api/admin/*` routes correctly call `requireAdmin(req)`.

---

## Findings

### CRITICAL

#### C1. Email-Only Sign-In -- No Credential Verification

**Files:** `src/modules/identity/application/session-auth.ts:71-127`, `src/app/api/auth/sign-in/route.ts`
**Confirmed by:** All 3 reviewers

The `signInWithEmail` function accepts only an email address and immediately creates a session. No password, no OTP, no magic link, no email confirmation. Anyone who knows or guesses a user's email can authenticate as that user and receive a valid 30-day session cookie.

```
POST /api/auth/sign-in
{"email": "victim@example.com"}
-> HTTP 201, Set-Cookie: shosetu_session=<valid_token>
```

The code comment explicitly says: "Replace with real auth (e.g. NextAuth) in a later phase." This placeholder was never replaced.

**Impact:** Complete account takeover for any user whose email is known.

---

#### C2. No Authentication on Most API Endpoints

**Files:** All routes under `src/app/api/` except `/api/admin/*`
**Confirmed by:** All 3 reviewers

Every destructive or expensive operation is accessible to unauthenticated users. `resolveUserContext()` silently falls back to a shared default user (`00000000-0000-4000-a000-000000000001`) when no session cookie is present.

**Unauthenticated operations that cost real money:**
- `POST /api/novels/[novelId]/bulk-translate-all` -- translate all episodes
- `POST /api/novels/[novelId]/bulk-translate` -- translate specific episodes
- `POST /api/translations/episodes/[episodeId]/request` -- translate single episode

**Unauthenticated destructive operations:**
- `DELETE /api/translations/episodes/[episodeId]/discard` -- delete translations
- `POST /api/novels/[novelId]/translations/discard` -- delete ALL translations for a novel
- `POST /api/novels/[novelId]/translate-session/abort` -- abort active sessions

**Unauthenticated data modification:**
- `PUT /api/novels/[novelId]/glossary` -- overwrite glossary/style guide
- `POST/PUT/DELETE glossary/entries/*` -- modify glossary entries
- `PUT /api/settings`, `PUT /api/progress` -- modify user state

**Impact:** Financial drain (OpenRouter API charges), data destruction, service disruption.

---

#### C3. Profile Takeover -- No Ownership Verification

**Files:** `src/modules/identity/application/profiles.ts:29-55,101-132`, `src/app/api/profiles/route.ts`, `src/app/api/profiles/active/route.ts`
**Confirmed by:** Penetration Tester, Senior SWE

Two compounding issues:

1. `GET /api/profiles` returns ALL user profiles (id, displayName, createdAt) with no auth check. Query filters only exclude the default user -- no scoping by owner.
2. `PUT /api/profiles/active` calls `selectProfile()` which accepts any UUID and sets it as the active profile cookie. No check that the requester owns that profile.

```
GET /api/profiles -> returns all profile UUIDs
PUT /api/profiles/active {"profileId": "<victim_uuid>"}
-> Active profile cookie set to victim; all subsequent requests act as victim
```

**Impact:** Full user impersonation. Combined with C1, enables complete multi-user compromise.

---

#### C4. Rate Limit Bypass via Spoofed IP Headers

**File:** `src/lib/rate-limit.ts:145-158`
**Confirmed by:** All 3 reviewers

`getClientIp()` trusts `X-Real-IP` first, then the **last** segment of `X-Forwarded-For`. Both headers are fully attacker-controlled when the app is directly internet-facing (no trusted proxy enforced).

```typescript
function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();             // attacker-controlled
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();      // also attacker-controlled
  }
  return "unknown";
}
```

Additionally, using `parts[parts.length - 1]` (rightmost) is the reverse of standard practice -- should be leftmost untrusted IP after stripping trusted proxies.

**Impact:** All rate limits (novel registration 5/min, translation 10/min, bulk operations) can be trivially bypassed by rotating `X-Real-IP` header values. Enables unlimited financial drain and job queue flooding.

---

### HIGH

#### H1. App Port Exposed on All Interfaces

**File:** `docker-compose.yml:37`

```yaml
app:
  ports:
    - "3000:3000"        # binds 0.0.0.0 -- all interfaces
db:
  ports:
    - "127.0.0.1:5432:5432"  # correctly restricted
redis:
  ports:
    - "127.0.0.1:6379:6379"  # correctly restricted
```

The `db` and `redis` services correctly bind to localhost. The `app` service does not, making it directly reachable on public IP, bypassing any reverse proxy TLS/access controls.

---

#### H2. Redis Has No Authentication

**Files:** `docker-compose.yml:15-22`, `src/lib/redis/client.ts`

Redis runs without `--requirepass`. Any process on the host can connect and manipulate:
- Job queues (inject/delete jobs)
- Rate limit counters (reset to bypass limits)
- Session-related data
- Operational metrics

---

#### H3. Hardcoded Database Credentials

**File:** `docker-compose.yml:6-11,27,42`

```yaml
POSTGRES_USER: shosetu
POSTGRES_PASSWORD: shosetu
DATABASE_URL: postgresql://shosetu:shosetu@db:5432/shosetu_reader
```

Default credentials hardcoded in both service definition and connection strings. Not read from `.env.production`.

---

#### H4. timingSafeEqual Leaks Key Length

**File:** `src/lib/auth/admin-guard.ts:47-53`

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;  // early exit leaks key length
  // ... constant-time comparison follows
}
```

The early return on length mismatch creates a timing oracle. An attacker can determine the exact length of `ADMIN_API_KEY` by measuring response times with tokens of varying lengths.

---

#### H5. CSP Allows unsafe-inline and unsafe-eval

**File:** `next.config.ts` (CSP header)

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

Both directives completely neutralize CSP's XSS protection. While no current XSS vectors were found, the app renders content from external sources (Syosetu scraping, AI translation) making this a high-risk gap.

---

#### H6. IDOR on Glossary Entry Update/Delete

**File:** `src/modules/translation/application/glossary-entries.ts:83-86,108,124`

`updateGlossaryEntry` and `deleteGlossaryEntry` query by `entryId` only, not scoped to `novelId`. An attacker who knows any `entryId` UUID can modify/delete glossary entries belonging to any novel, regardless of the `novelId` in the URL.

---

#### H7. Prompt Injection via Glossary Terms

**Files:** `src/app/api/novels/[novelId]/glossary/entries/route.ts`, translation module prompt builder

Glossary entries (`termJa`, `termKo`, `notes`, style guide) are injected into the system prompt sent to the LLM. With no auth on the glossary endpoints, anyone can inject adversarial content:

```
POST /api/novels/<novelId>/glossary/entries
{"termJa": "IGNORE ALL PREVIOUS INSTRUCTIONS...", "termKo": "...", "category": "term"}
```

The `notes` field and style guide (up to 50,000 chars) become part of every translation prompt. Can manipulate translation output, extract system prompts, or inflate token costs.

---

### MEDIUM

#### M1. No TLS Termination in Docker Compose

No reverse proxy (nginx, Caddy, Traefik) configured. App serves plain HTTP on port 3000. Without HTTPS:
- Session cookies interceptable (missing `Secure` flag in dev)
- API keys in headers visible
- HSTS header meaningless

---

#### M2. Session Cookie Missing Secure Flag in Non-Production

**File:** `src/modules/identity/infra/session-cookie.ts`

`secure` flag is tied to `NODE_ENV === "production"`, but the app may be accessed over HTTPS even in development. Should derive from `APP_URL.startsWith("https://")`.

---

#### M3. No Container Resource Limits

**File:** `docker-compose.yml`

No `deploy.resources.limits` on any container. No memory, CPU, or PID limits. A runaway process or DoS attack can affect the entire host.

---

#### M4. Bulk Glossary Import Lacks Per-Entry Validation

**File:** `src/app/api/novels/[novelId]/glossary/entries/import/route.ts`

Import endpoint accepts up to 500 entries with no per-entry schema validation. Attacker can set `status: "confirmed"`, arbitrary `importance`, or inject oversized content. The single-entry POST validates; the bulk import does not.

---

#### M5. Unvalidated Model Override on Translation Request

**File:** `src/app/api/translations/episodes/[episodeId]/request/route.ts:22-31`

Accepts optional `modelName` with only a length check (`<= 200`), unlike `/api/translation-settings` which calls `isKnownOpenRouterModel()`. Can send arbitrary model names, causing errors or unexpected cost.

---

#### M6. Docker Images Not Pinned to Digest

**Files:** `Dockerfile:1`, `docker-compose.yml:4,16`

`node:22-alpine`, `postgres:16-alpine`, `redis:7-alpine` are tagged but not pinned to SHA256 digests. Supply chain risk if images are compromised between builds.

---

### LOW

#### L1. No Audit Logging

No audit trail for security-sensitive operations (sign-in, sign-out, admin access, translation deletion, glossary modification, profile switches). Incident investigation would be difficult.

---

#### L2. SSE Endpoint Without Connection Limits

**File:** `src/app/api/novels/[novelId]/live-status/route.ts`

No limit on concurrent SSE connections per client/IP. Connection exhaustion possible.

---

## Attack Chains

### Chain 1: Financial Drain (Easy, no auth required)
1. Discover novels via `GET /api/ranking` (public)
2. For each novel: `POST /api/novels/{id}/bulk-translate-all` (no auth)
3. Bypass rate limit by rotating `X-Real-IP` header
4. OpenRouter charges accumulate -- potentially thousands of dollars per novel

### Chain 2: Data Destruction (Easy, no auth required)
1. Enumerate novels via `GET /api/ranking`
2. For each: `POST /api/novels/{id}/translations/discard`
3. All translations deleted. No audit trail, no undo.

### Chain 3: Full User Impersonation (Easy)
1. `GET /api/profiles` -- enumerate all profile UUIDs (no auth)
2. `PUT /api/profiles/active {"profileId": "<victim>"}` -- become victim
3. Access library, settings, progress, glossaries as victim
4. Session persists for 30 days

### Chain 4: Prompt Injection + Translation Manipulation (Easy)
1. `POST /api/novels/{id}/glossary/entries` with adversarial `notes` field
2. All subsequent translations for that novel are corrupted
3. Injected content becomes part of every system prompt

---

## Implementation Plan

### Phase 1: Immediate (Before Any Public Exposure)

These must be completed before the app is accessible from untrusted networks.

#### 1.1 Add auth middleware to all write endpoints
- Create a shared `requireAuth()` middleware that returns 401 if user is not authenticated
- Apply to all POST/PUT/DELETE routes except `/api/auth/sign-in`, `/api/health`
- Read endpoints for public data (ranking, novel metadata) can remain open
- **Files to modify:** Every route file under `src/app/api/` (except admin routes which already have guards)

#### 1.2 Scope profile operations to current user
- `GET /api/profiles` must only return profiles belonging to the authenticated user (or tied to the current session)
- `PUT /api/profiles/active` must verify the target profile belongs to the current user
- **File:** `src/modules/identity/application/profiles.ts`

#### 1.3 Bind app port to localhost
- Change `docker-compose.yml` from `"3000:3000"` to `"127.0.0.1:3000:3000"`
- Add a reverse proxy (Caddy recommended for auto-TLS) as a new service
- **File:** `docker-compose.yml`

#### 1.4 Add Redis authentication
- Add `--requirepass ${REDIS_PASSWORD}` to Redis command in docker-compose
- Update Redis URL to include password: `redis://:${REDIS_PASSWORD}@redis:6379`
- **Files:** `docker-compose.yml`, `.env.production`

#### 1.5 Externalize database credentials
- Replace hardcoded `shosetu/shosetu` with `${POSTGRES_USER}`, `${POSTGRES_PASSWORD}` variables
- Document required env vars in `.env.example`
- **File:** `docker-compose.yml`

#### 1.6 Fix rate limiter IP resolution
- When behind trusted proxy: take only `X-Real-IP` set by the proxy, ignore `X-Forwarded-For`
- When direct: use Next.js `request.ip` or TCP connection address
- Add config option: `TRUSTED_PROXY=true/false`
- **File:** `src/lib/rate-limit.ts`

### Phase 2: Hardening (Security Sprint)

#### 2.1 Implement real authentication
- Option A: Magic-link email authentication (send verification link to email)
- Option B: NextAuth.js with OAuth providers (Google, GitHub)
- Option C: Passkey/WebAuthn (most secure, best UX)
- Replace the placeholder sign-in flow entirely
- **Files:** `src/modules/identity/`, `src/app/api/auth/`

#### 2.2 Fix timingSafeEqual
- Replace custom implementation with Node's `crypto.timingSafeEqual`
- Hash both sides with SHA-256 first to eliminate length oracle:
```typescript
import { timingSafeEqual as tse, createHash } from "crypto";
function safeEqual(a: string, b: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return tse(h(a), h(b));
}
```
- **File:** `src/lib/auth/admin-guard.ts`

#### 2.3 Fix IDOR on glossary entries
- Add `eq(novelGlossaryEntries.novelId, novelId)` to WHERE clause in update and delete operations
- **File:** `src/modules/translation/application/glossary-entries.ts`

#### 2.4 Validate bulk glossary import entries
- Apply Zod schema to each entry in the import array, matching single-entry POST validation
- **File:** `src/app/api/novels/[novelId]/glossary/entries/import/route.ts`

#### 2.5 Validate model override on translation request
- Call `isKnownOpenRouterModel()` in the translation request endpoint, matching settings endpoint behavior
- **File:** `src/app/api/translations/episodes/[episodeId]/request/route.ts`

#### 2.6 Strengthen CSP
- Remove `unsafe-eval` (investigate if any dependency requires it; likely not in production)
- Replace `unsafe-inline` with nonce-based script policy for Next.js
- **File:** `next.config.ts`

#### 2.7 Add TLS termination
- Add Caddy service to docker-compose with automatic HTTPS
- Configure as reverse proxy to app:3000
- **Files:** `docker-compose.yml`, new `Caddyfile`

#### 2.8 Add container resource limits
- Set memory and CPU limits on all services
- Add `pids_limit` for fork bomb protection
- **File:** `docker-compose.yml`

### Phase 3: Defense in Depth (Next Iteration)

#### 3.1 Rate limit all write endpoints
- Add rate limiting to: sign-in, bulk-translate, ingest-all, reingest-all, glossary import, SSE connections, translation discard
- Per-user rate limits (not just per-IP) for authenticated users

#### 3.2 Add audit logging
- Log security events: sign-in, sign-out, profile switch, admin access, translation deletion, glossary modification
- Structured log format for external aggregation

#### 3.3 Pin Docker images to digests
- Pin `node`, `postgres`, `redis` images to specific SHA256 digests
- Document update procedure

#### 3.4 Separate database users
- Create read-write runtime user (DML only) for app and worker
- Keep DDL-capable user for migrations only

#### 3.5 Add Docker network segmentation
- Frontend network: reverse proxy + app
- Backend network: app + db + redis + worker
- Worker should not be directly accessible

#### 3.6 Add basic prompt injection defenses for glossary
- Sanitize/escape glossary entries before injection into translation prompts
- Limit character set in `notes` field
- Add max length constraints to all glossary text fields

#### 3.7 Session security improvements
- Derive `Secure` cookie flag from `APP_URL` scheme, not `NODE_ENV`
- Add `__Host-` prefix to session and profile cookies
- Reduce session lifetime from 30 days to 7 days
- Add session revocation (invalidate all sessions for a user)
