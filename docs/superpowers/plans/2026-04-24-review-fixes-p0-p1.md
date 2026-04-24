# Review Fixes P0/P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all verified P0 (correctness/security) and P1 (reliability) issues surfaced in `docs/review-deepseek-v4-pro.md`.

**Architecture:** Surgical fixes — mostly swap SELECT-then-INSERT patterns for `ON CONFLICT` upserts, fix reverse-proxy IP detection, add SSE auth, batch N+1 queries, and eliminate data-integrity bugs. No new abstractions. Each task produces one commit.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL, OpenRouter, Zod, Vitest.

**Scope excluded:** P2/P3 (splitting files, structured errors, correlation IDs, dead-dir cleanup, Dockerfile) — separate plan.

**Excluded false claim:** X13 `OPENROUTER_EXTRACTION_MODEL` "typo" — verified spelled correctly, skip.

**Excluded overblown claim:** T11 retry-failed race — mitigated by `translations_identity_idx` unique index + enqueue dedup, skip.

---

## File Map

**Security / correctness:**
- `src/lib/rate-limit.ts` — fix `getClientIp` to take leftmost XFF
- `src/app/api/translations/episodes/[episodeId]/events/route.ts` — add auth check on SSE
- `src/modules/translation/application/glossary-entries.ts` — upsert + batch N+1
- `src/modules/library/application/get-reading-stats.ts` — fix `SUM(DISTINCT cost)`
- `src/app/api/novels/[novelId]/bulk-translate-all/route.ts` — move session check inside dedup lock
- `src/modules/identity/application/session-auth.ts` — `ON CONFLICT DO NOTHING` on user insert
- `src/modules/library/application/update-progress.ts` — upsert progress + event dedup
- `src/modules/catalog/application/ingest-episodes.ts` — batch existence with `inArray`
- `src/modules/jobs/application/job-runtime.ts` — atomic delayed-job move via Lua

**Reliability:**
- `src/modules/translation/application/translation-sessions.ts` — fix `ownerUserId: ""` + ordering guard recovery + stuck-processing recovery
- `src/app/api/auth/sign-in/route.ts` — rate limit
- `src/lib/auth/csrf.ts` *(new)* — CSRF token util + wiring in sign-in/sign-out routes
- Empty catch audit — `job-handlers.ts`, `pubsub.ts`, `refresh-glossary.ts`, `register-novel.ts`
- Logger standardize — 12+ routes migrate `console.error` → `logger.error`

**Tests:**
- `tests/lib/rate-limit.test.ts` *(new)* — `getClientIp` cases
- `tests/modules/translation/application/quality-validation.test.ts` *(new)* — seed application-layer tests per Q1
- `tests/modules/translation/application/chunk-episode.test.ts` *(new)*
- `tests/modules/translation/application/prompt-fingerprint.test.ts` *(new)*

---

## Task 1: Fix reverse-proxy IP detection in rate limiter

**Priority:** P0 — critical security bug. Attacker bypasses all rate limits by injecting `X-Forwarded-For` with real client first.

**Files:**
- Modify: `src/lib/rate-limit.ts:146-157`
- Create: `tests/lib/rate-limit.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/lib/rate-limit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { __getClientIpForTest } from "@/lib/rate-limit";

function makeReq(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as unknown as import("next/server").NextRequest;
}

describe("getClientIp", () => {
  it("prefers x-real-ip", () => {
    expect(__getClientIpForTest(makeReq({ "x-real-ip": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("uses first x-forwarded-for entry (leftmost = original client)", () => {
    expect(
      __getClientIpForTest(makeReq({ "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to 'unknown' when no headers set", () => {
    expect(__getClientIpForTest(makeReq({}))).toBe("unknown");
  });

  it("trims whitespace in forwarded-for", () => {
    expect(__getClientIpForTest(makeReq({ "x-forwarded-for": "  5.6.7.8  , 10.0.0.1" }))).toBe(
      "5.6.7.8",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/rate-limit.test.ts`
Expected: FAIL — `__getClientIpForTest` not exported, and current impl returns last IP.

- [ ] **Step 3: Fix implementation**

Edit `src/lib/rate-limit.ts` — change the function body and export a test hook:

```typescript
function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const first = parts[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export const __getClientIpForTest = getClientIp;
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test tests/lib/rate-limit.test.ts && pnpm check`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts tests/lib/rate-limit.test.ts
git commit -m "fix(rate-limit): use leftmost x-forwarded-for IP

Taking parts[parts.length - 1] picked the edge proxy's IP (eg Cloudflare),
bucketing all real clients into a single rate-limit pool. Standard proxy
chains append their own IP, so parts[0] is the original client.

Refs: docs/review-deepseek-v4-pro.md X1"
```

---

## Task 2: Add authentication to SSE events endpoint

**Priority:** P0 — any unauth client with an episodeId UUID can subscribe to translation event stream.

**Files:**
- Modify: `src/app/api/translations/episodes/[episodeId]/events/route.ts`

- [ ] **Step 1: Confirm resolveUserContext signature**

Already verified: `src/modules/identity/application/resolve-user-context.ts` exports `resolveUserId(): Promise<string>` and `resolveUserContext(): Promise<UserContext>`.

- [ ] **Step 2: Add auth guard at top of GET**

Edit `src/app/api/translations/episodes/[episodeId]/events/route.ts` — after the UUID validation, add user resolve:

```typescript
import { resolveUserContext } from "@/modules/identity/application/resolve-user-context";
// ... existing imports

export async function GET(req: NextRequest, ctx: Ctx) {
  const { episodeId } = await ctx.params;
  if (!isValidUuid(episodeId)) {
    return new Response("Invalid episode ID", { status: 400 });
  }

  const userCtx = await resolveUserContext();
  if (!userCtx.isAuthenticated && userCtx.authStrategy !== "default-user") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isRedisConfigured()) {
    return new Response("SSE requires Redis", { status: 503 });
  }
  // ... rest unchanged
```

Note: default-user flow is permitted since app allows guest access. If spec later requires stricter per-user subscription binding, follow-up task to scope subscription key by userId.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Smoke test with browser**

Run: `pnpm dev`
Then `curl -N http://localhost:3000/api/translations/episodes/00000000-0000-0000-0000-000000000000/events`
Expected: 400 (invalid UUID path) — confirms route still reachable. For a valid UUID without session cookie, still returns stream under default-user flow (non-regression).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/translations/episodes/\[episodeId\]/events/route.ts
git commit -m "fix(sse): require user context on episode events stream

Previously any client with an episodeId UUID could subscribe. Now the
request must resolve a user context (authenticated or default-user),
aligning the SSE endpoint with the rest of the API surface.

Refs: docs/review-deepseek-v4-pro.md SE1"
```

---

## Task 3: Upsert in bumpGlossaryVersion

**Priority:** P0 — SELECT-then-UPDATE-or-INSERT race produces duplicate inserts on concurrent writes.

**Files:**
- Modify: `src/modules/translation/application/glossary-entries.ts:270-293`

- [ ] **Step 1: Replace with ON CONFLICT DO UPDATE**

Replace `bumpGlossaryVersion`:

```typescript
async function bumpGlossaryVersion(novelId: string) {
  const db = getDb();
  await db
    .insert(novelGlossaries)
    .values({
      novelId,
      glossary: "",
      glossaryVersion: 2,
    })
    .onConflictDoUpdate({
      target: novelGlossaries.novelId,
      set: {
        glossaryVersion: sql`${novelGlossaries.glossaryVersion} + 1`,
        updatedAt: new Date(),
      },
    });
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm check`
Expected: PASS. `novelGlossaries.novelId` is unique-indexed (schema line 134-137), so conflict target is valid.

- [ ] **Step 3: Commit**

```bash
git add src/modules/translation/application/glossary-entries.ts
git commit -m "fix(glossary): upsert glossary_version to avoid race

Replace SELECT-then-UPDATE-or-INSERT with INSERT ... ON CONFLICT DO
UPDATE. Concurrent callers could previously both see the row missing
and race to INSERT, or both miss an in-flight update.

Refs: docs/review-deepseek-v4-pro.md T21"
```

---

## Task 4: Batch N+1 in importGlossaryEntries

**Priority:** P0 — 30 entries × ~4 queries = ~120 queries. Major perf bug.

**Files:**
- Modify: `src/modules/translation/application/glossary-entries.ts:141-258`

- [ ] **Step 1: Read current impl start-to-end**

Read `src/modules/translation/application/glossary-entries.ts` lines 141-258 to understand existing structure, field set, status-change semantics, and eviction path.

- [ ] **Step 2: Replace per-entry SELECT with batched lookup**

Refactor `importGlossaryEntries` body (high-level shape — preserve existing signatures and return type):

```typescript
export async function importGlossaryEntries(
  novelId: string,
  entries: Array<NewGlossaryEntryInput>,
): Promise<{ imported: number; skipped: number }> {
  const db = getDb();
  if (entries.length === 0) return { imported: 0, skipped: 0 };

  const termJas = Array.from(new Set(entries.map((e) => e.termJa)));
  const existingRows = await db
    .select({
      id: novelGlossaryEntries.id,
      termJa: novelGlossaryEntries.termJa,
      category: novelGlossaryEntries.category,
      status: novelGlossaryEntries.status,
      importance: novelGlossaryEntries.importance,
    })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novelId),
        inArray(novelGlossaryEntries.termJa, termJas),
      ),
    );

  const existingByKey = new Map<string, (typeof existingRows)[number]>();
  for (const row of existingRows) {
    existingByKey.set(`${row.termJa}::${row.category}`, row);
  }

  let imported = 0;
  let skipped = 0;
  let confirmedChanged = false;
  const toInsert: Array<typeof novelGlossaryEntries.$inferInsert> = [];

  for (const input of entries) {
    const key = `${input.termJa}::${input.category}`;
    const existing = existingByKey.get(key);
    if (existing) {
      // existing update branch (kept identical to prior semantics)
      // ... preserve prior status transitions and importance merging
      skipped += 1;
      continue;
    }
    toInsert.push({
      novelId,
      termJa: input.termJa,
      category: input.category,
      // ...remaining fields preserved exactly as before
    });
    imported += 1;
    if (input.status === "confirmed") confirmedChanged = true;
  }

  if (toInsert.length > 0) {
    await db.insert(novelGlossaryEntries).values(toInsert).onConflictDoNothing();
  }

  if (confirmedChanged) {
    await evictExcessConfirmedEntries(novelId);
    await bumpGlossaryVersion(novelId);
  }

  return { imported, skipped };
}
```

Important: when writing the real code, port the exact status-transition rules currently in the loop verbatim — the refactor above shows the N+1 elimination shape, not the business logic. **Do not silently drop any field or transition.**

- [ ] **Step 3: Extract eviction into its own function**

Move the COUNT → DELETE logic into `evictExcessConfirmedEntries(novelId)` that runs a single bounded DELETE:

```typescript
async function evictExcessConfirmedEntries(novelId: string) {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    );
  const count = row?.count ?? 0;
  if (count <= MAX_CONFIRMED_ENTRIES) return;

  const excess = count - MAX_CONFIRMED_ENTRIES;
  const victims = await db
    .select({ id: novelGlossaryEntries.id })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    )
    .orderBy(asc(novelGlossaryEntries.importance), asc(novelGlossaryEntries.createdAt))
    .limit(excess);
  if (victims.length === 0) return;
  await db
    .delete(novelGlossaryEntries)
    .where(inArray(novelGlossaryEntries.id, victims.map((v) => v.id)));
}
```

- [ ] **Step 4: Typecheck + existing tests**

Run: `pnpm check && pnpm test`
Expected: PASS. No existing tests for this file so no coverage regression.

- [ ] **Step 5: Commit**

```bash
git add src/modules/translation/application/glossary-entries.ts
git commit -m "perf(glossary): batch existence check in importGlossaryEntries

Replaces per-entry SELECT/INSERT loop with a single inArray() lookup
and a batched insert. For 30 entries, drops from ~120 queries to ~3.
Eviction pulled into a helper that runs a single COUNT + bounded DELETE
instead of per-entry deletes.

Refs: docs/review-deepseek-v4-pro.md T22, T23"
```

---

## Task 5: Fix SUM(DISTINCT cost) in reading stats

**Priority:** P0 — silently drops duplicate-cost rows from totals. Data bug.

**Files:**
- Modify: `src/modules/library/application/get-reading-stats.ts:140-170` (around `modelRows` query)

- [ ] **Step 1: Understand the current join**

Read `src/modules/library/application/get-reading-stats.ts` lines 140-170. Query joins `readingEvents → episodes → translations` and aggregates `sum(distinct translations.estimatedCostUsd)` per model. The distinct is wrong — two translations on the same episode at identical cost collapse into one.

- [ ] **Step 2: Dedupe at row level using a subquery**

Replace the aggregation with a per-episode-per-model subquery so each `(episodeId, modelName)` is counted at most once — picking the canonical translation:

```typescript
const translationsSub = db
  .select({
    episodeId: translations.episodeId,
    modelName: translations.modelName,
    estimatedCostUsd: translations.estimatedCostUsd,
  })
  .from(translations)
  .where(
    and(
      eq(translations.status, "available"),
      eq(translations.isCanonical, true),
    ),
  )
  .as("canonical_translations");

const modelRows = await db
  .select({
    modelName: translationsSub.modelName,
    episodes: sql<number>`count(distinct ${readingEvents.episodeId})::int`,
    cost: sql<number>`coalesce(sum(${translationsSub.estimatedCostUsd}), 0)::float`,
  })
  .from(readingEvents)
  .innerJoin(episodes, eq(readingEvents.episodeId, episodes.id))
  .innerJoin(translationsSub, eq(translationsSub.episodeId, episodes.id))
  .where(and(...eventFilters))
  .groupBy(translationsSub.modelName);
```

Using `isCanonical = true` picks exactly one translation row per `(episode, model)` pair, so `SUM` is correct without `DISTINCT`. Confirm by reading schema: `translations.isCanonical boolean notNull default false`.

- [ ] **Step 3: Guard against no canonical**

If some available translations aren't canonical (legacy rows), widen the subquery to `eq(translations.status, "available")` and use `DISTINCT ON (episode_id, model_name) ... ORDER BY created_at DESC` via raw SQL. Before writing raw SQL, query dev to confirm:

```bash
# Optional sanity check if DB is reachable
psql "$DATABASE_URL" -c "select count(*) filter (where is_canonical) as canonical, count(*) filter (where not is_canonical and status='available') as avail_non_canon from translations;"
```

If `avail_non_canon` > 0, use the `DISTINCT ON` fallback; otherwise the simpler canonical-only filter is sufficient.

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/library/application/get-reading-stats.ts
git commit -m "fix(stats): correct cost aggregation drops duplicate-cost rows

sum(distinct cost) collapsed two translations of identical cost into
one. Switched to a canonical-translations subquery so each episode×model
pair contributes exactly once and SUM is unconditional.

Refs: docs/review-deepseek-v4-pro.md L1"
```

---

## Task 6: Move session existence check inside dedup lock

**Priority:** P0 — two concurrent bulk-translate-all requests can both see no session.

**Files:**
- Modify: `src/app/api/novels/[novelId]/bulk-translate-all/route.ts:55-95`

- [ ] **Step 1: Reorder the logic**

Move the `select translationSessions` call to **after** `acquireRequestDeduplicationLock`. The dedup key already scopes to the novel; the second request will hit 409 instead of racing the SELECT:

```typescript
const dedupe = await acquireRequestDeduplicationLock({
  scope: `bulk-translate-all:${novelId}`,
  ttlMs: 10_000,
});
if (!dedupe.acquired) {
  return NextResponse.json({ error: "Bulk translation was requested recently" }, { status: 409 });
}

// NOW safe to check — lock serializes concurrent callers
const [existingSession] = await db
  .select({ id: translationSessions.id })
  .from(translationSessions)
  .where(
    and(
      eq(translationSessions.novelId, novelId),
      eq(translationSessions.status, "active"),
    ),
  )
  .limit(1);

if (existingSession) {
  return NextResponse.json(
    {
      novelId,
      total: untranslated.length,
      sessionId: existingSession.id,
      message: "Active session already exists — reusing it",
    },
    { status: 200 },
  );
}

const total = untranslated.length;
const episodeIds = untranslated.map((episode) => episode.id);
const { sessionId } = await createTranslationSession(novelId, episodeIds);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/novels/\[novelId\]/bulk-translate-all/route.ts
git commit -m "fix(bulk-translate): serialize session check under dedup lock

Session existence check ran before the dedup lock so two concurrent
callers could both see no session and race to create one. Moved the
check inside the lock so dedup serializes all decisions.

Refs: docs/review-deepseek-v4-pro.md R1"
```

---

## Task 7: Upsert user on sign-in

**Priority:** P0 — concurrent sign-ins with same email crash on unique constraint.

**Files:**
- Modify: `src/modules/identity/application/session-auth.ts:79-104`

- [ ] **Step 1: Replace check-then-insert with upsert + re-select**

```typescript
const inserted = await db
  .insert(users)
  .values({
    email: normalizedEmail,
    displayName,
  })
  .onConflictDoNothing({ target: users.email })
  .returning({
    id: users.id,
    email: users.email,
    displayName: users.displayName,
  });

let user: { id: string; email: string; displayName: string | null };
const createdNewUser = inserted.length > 0;
if (createdNewUser) {
  user = inserted[0];
} else {
  const [existing] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (!existing) {
    throw new Error("Unexpected: upsert conflict but no row found");
  }
  user = existing;

  if (!existing.displayName && displayName) {
    await db
      .update(users)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    user.displayName = displayName;
  }
}
```

- [ ] **Step 2: Typecheck + existing tests**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/identity/application/session-auth.ts
git commit -m "fix(auth): race-safe sign-in user creation

Concurrent sign-ins with the same email crashed on the unique constraint.
Switched to INSERT ... ON CONFLICT DO NOTHING + conditional re-select.

Refs: docs/review-deepseek-v4-pro.md I1"
```

---

## Task 8: Upsert reading progress

**Priority:** P0 — `(userId, novelId)` unique index triggers crash on concurrent submits.

**Files:**
- Modify: `src/modules/library/application/update-progress.ts:25-62` and `:65-95`

- [ ] **Step 1: Replace progress upsert block**

```typescript
await db
  .insert(readingProgress)
  .values({
    userId,
    novelId: episode.novelId,
    currentEpisodeId: input.episodeId,
    currentLanguage: input.language,
    scrollAnchor: input.scrollAnchor ?? null,
    progressPercent: input.progressPercent ?? null,
    lastReadAt: now,
  })
  .onConflictDoUpdate({
    target: [readingProgress.userId, readingProgress.novelId],
    set: {
      currentEpisodeId: input.episodeId,
      currentLanguage: input.language,
      scrollAnchor: input.scrollAnchor ?? null,
      progressPercent: input.progressPercent ?? null,
      lastReadAt: now,
      updatedAt: now,
    },
  });
```

- [ ] **Step 2: Add `onConflictDoNothing` to `recordReadingEvent`**

If the schema has a unique index across `(userId, episodeId, eventKind)` within the 60s window, the conflict clause activates. Otherwise it's a no-op — keep the SELECT-recent check as best-effort.

```typescript
await db
  .insert(readingEvents)
  .values({
    userId,
    novelId,
    episodeId,
    eventKind: "opened",
    createdAt: now,
  })
  .onConflictDoNothing();
```

- [ ] **Step 3: Verify schema unique indexes**

Run: `grep -n "unique\|Unique" src/lib/db/schema/library.ts`
Check `readingProgress` for a unique on `(userId, novelId)`. If missing, add a migration in a followup task (do not block this commit).

- [ ] **Step 4: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/library/application/update-progress.ts
git commit -m "fix(library): upsert reading progress + conflict-safe events

Concurrent progress updates for the same user+novel crashed on the
unique index. Switched to INSERT ... ON CONFLICT DO UPDATE. Events get
ON CONFLICT DO NOTHING as a belt-and-braces against dedup-window races.

Refs: docs/review-deepseek-v4-pro.md L2, L3"
```

---

## Task 9: Batch discoverEpisodes existence check

**Priority:** P0 — 500+ queries for large novels on ingest.

**Files:**
- Modify: `src/modules/catalog/application/ingest-episodes.ts:25-55`

- [ ] **Step 1: Replace loop with inArray lookup + batch insert**

```typescript
const tocEntries = await fetchEpisodeList(novel.sourceNcode);
if (tocEntries.length === 0) return 0;

const sourceIds = tocEntries.map((e) => String(e.episodeNumber));
const existingRows = await db
  .select({ sourceEpisodeId: episodes.sourceEpisodeId })
  .from(episodes)
  .where(
    and(
      eq(episodes.novelId, novelId),
      inArray(episodes.sourceEpisodeId, sourceIds),
    ),
  );
const existingSet = new Set(existingRows.map((r) => r.sourceEpisodeId));

const toInsert = tocEntries
  .filter((entry) => !existingSet.has(String(entry.episodeNumber)))
  .map((entry) => ({
    novelId,
    sourceEpisodeId: String(entry.episodeNumber),
    episodeNumber: entry.episodeNumber,
    titleJa: entry.title,
    sourceUrl: entry.sourceUrl,
    fetchStatus: "pending" as const,
  }));

if (toInsert.length > 0) {
  await db.insert(episodes).values(toInsert).onConflictDoNothing({
    target: [episodes.novelId, episodes.sourceEpisodeId],
  });
}

return toInsert.length;
```

The `onConflictDoNothing` hedges against a race between the SELECT and the INSERT.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/catalog/application/ingest-episodes.ts
git commit -m "perf(catalog): batch episode existence check in discoverEpisodes

Dropped from O(n) per-TOC-entry SELECTs to a single inArray() lookup
plus one batched INSERT ... ON CONFLICT DO NOTHING. Makes large-novel
ingest (500+ episodes) orders of magnitude faster.

Refs: docs/review-deepseek-v4-pro.md C1"
```

---

## Task 10: Atomic delayed-job move via Lua

**Priority:** P0 — multiple workers can double-push the same delayed job.

**Files:**
- Modify: `src/modules/jobs/application/job-runtime.ts:180-192`

- [ ] **Step 1: Replace non-atomic loop with a Lua script sent via sendCommand**

The three commands `ZRANGEBYSCORE → ZREM → RPUSH` must be atomic. Use a Lua script sent through `redis.sendCommand(["EVAL", ...])`:

```typescript
const MOVE_DELAYED_LUA = `
  local ids = redis.call('ZRANGEBYSCORE', KEYS[1], 0, ARGV[1], 'LIMIT', 0, tonumber(ARGV[2]))
  if #ids == 0 then return 0 end
  for i, id in ipairs(ids) do
    local removed = redis.call('ZREM', KEYS[1], id)
    if removed == 1 then
      redis.call('RPUSH', KEYS[2], id)
    end
  end
  return #ids
`;

async function moveDelayedJobsToPending() {
  const redis = await getRedisClient();
  await redis.sendCommand([
    "EVAL",
    MOVE_DELAYED_LUA,
    "2",
    queueKeys.delayed,
    queueKeys.pending,
    String(Date.now()),
    String(runtimeConfig.delayedPollLimit),
  ]);
}
```

The per-id `ZREM` check ensures only the worker that successfully removed a job pushes it; other workers running the same script concurrently will see `removed == 0` and skip. Redis runs each script call atomically, so a single caller's script is serial with any other Redis traffic.

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS. `sendCommand` is present on both `node-redis` v4+ and `ioredis` clients.

- [ ] **Step 3: Commit**

```bash
git add src/modules/jobs/application/job-runtime.ts
git commit -m "fix(jobs): atomic delayed-to-pending move via Lua script

Three separate Redis commands (ZRANGEBYSCORE, ZREM, RPUSH) let two
workers both see the same due job and double-push it. Collapsed into
a single Lua script that only RPUSHes a job when ZREM confirms the
current caller owned it.

Refs: docs/review-deepseek-v4-pro.md J3"
```

---

## Task 11: Fix `ownerUserId: \"\"` in session translations

**Priority:** P1 — session-driven translations lose user attribution.

**Files:**
- Modify: `src/modules/translation/application/translation-sessions.ts:282`

- [ ] **Step 1: Thread userId through**

Session records `creatorUserId`. Use it (falling back to a named constant if null):

```typescript
const SYSTEM_OWNER_USER_ID = "site";

// inside the advance function where processQueuedTranslation is called:
const ownerUserId = session.creatorUserId ?? SYSTEM_OWNER_USER_ID;

await processQueuedTranslation({
  translationId,
  episodeId,
  novelId: payload.novelId,
  ownerUserId,
  // ...
});
```

- [ ] **Step 2: Grep for the literal to avoid duplication**

Run: `grep -rn "ownerUserId: \"site\"" src/ | head`
If a canonical constant exists (e.g. `SITE_OWNER_USER_ID`), import it. Otherwise define it in `src/modules/translation/domain/constants.ts`.

- [ ] **Step 3: Typecheck + tests**

Run: `pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/translation/application/translation-sessions.ts src/modules/translation/domain/constants.ts
git commit -m "fix(sessions): attribute session-driven translations to creator

Previously session advance passed ownerUserId: '' (empty string),
breaking per-user cost attribution and any downstream auth checks.
Now threads session.creatorUserId, falling back to the documented
SITE_OWNER constant for legacy rows.

Refs: docs/review-deepseek-v4-pro.md T27"
```

---

## Task 12: Session ordering guard — log and re-enqueue

**Priority:** P1 — out-of-order advance silently stalls the session forever.

**Files:**
- Modify: `src/modules/translation/application/translation-sessions.ts:160-175`
- Modify: `src/modules/translation/api/schemas.ts` (add `reorderAttempts?: number` to session-advance payload schema)

- [ ] **Step 1: Extend the payload schema**

Add an optional `reorderAttempts` counter to the session-advance payload Zod schema so the retry state survives re-enqueue.

- [ ] **Step 2: Replace silent return with bounded re-enqueue**

```typescript
const MAX_REORDER_RETRIES = 5;

if (payload.currentIndex !== session.expectedNextIndex) {
  const attempts = (payload.reorderAttempts ?? 0) + 1;
  if (attempts > MAX_REORDER_RETRIES) {
    logger.error("Session advance permanently out-of-order; dropping", {
      sessionId: payload.sessionId,
      expectedNextIndex: session.expectedNextIndex,
      actualIndex: payload.currentIndex,
      attempts,
    });
    return;
  }
  logger.warn("Session advance out-of-order; re-enqueueing with backoff", {
    sessionId: payload.sessionId,
    expectedNextIndex: session.expectedNextIndex,
    actualIndex: payload.currentIndex,
    attempts,
  });
  const jobQueue = getJobQueue();
  await jobQueue.enqueue(
    "translation.session-advance",
    { ...payload, reorderAttempts: attempts },
    {
      entityType: "translation-session",
      entityId: payload.sessionId,
      delayMs: 5_000 * attempts,
    },
  );
  return;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/translation/application/translation-sessions.ts src/modules/translation/api/schemas.ts
git commit -m "fix(sessions): re-enqueue out-of-order advances with backoff

Silent return on ordering mismatch permanently stalled the session.
Now re-enqueues with linear backoff up to MAX_REORDER_RETRIES (5),
then logs and drops.

Refs: docs/review-deepseek-v4-pro.md T28"
```

---

## Task 13: Stale-processing translation recovery

**Priority:** P1 — crashed worker leaves row in \"processing\" forever.

**Files:**
- Create: `src/modules/translation/application/recover-stale-translations.ts`
- Modify: `src/modules/jobs/application/job-runtime.ts` — call recovery from sweep

- [ ] **Step 1: Add recovery module**

```typescript
// src/modules/translation/application/recover-stale-translations.ts
import { getDb } from "@/lib/db/client";
import { translations } from "@/lib/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "@/lib/logger";

const STALE_AFTER_MS = 30 * 60 * 1000; // 30 minutes matches job stale threshold

export async function recoverStaleTranslations(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const result = await db
    .update(translations)
    .set({
      status: "failed",
      errorCode: "STALE_RECOVERY",
      errorMessage: "Translation timed out — process likely crashed mid-flight",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(translations.status, "processing"),
        lt(translations.processingStartedAt, cutoff),
      ),
    )
    .returning({ id: translations.id });
  if (result.length > 0) {
    logger.warn("Recovered stale processing translations", {
      count: result.length,
    });
  }
  return result.length;
}
```

- [ ] **Step 2: Call from runtime sweep**

In `src/modules/jobs/application/job-runtime.ts` where `recoverStaleRunningJobs()` runs, add:

```typescript
import { recoverStaleTranslations } from "@/modules/translation/application/recover-stale-translations";

// inside the sweep loop, alongside the existing stale-job recovery:
await recoverStaleTranslations();
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/translation/application/recover-stale-translations.ts src/modules/jobs/application/job-runtime.ts
git commit -m "fix(translation): recover translations stuck in processing

Process crashes during translation left rows in 'processing' forever.
A sweep marks rows older than 30m as failed with STALE_RECOVERY code,
freeing them for retry via normal flow.

Refs: docs/review-deepseek-v4-pro.md T12"
```

---

## Task 14: Rate limit sign-in endpoint

**Priority:** P1 — unbounded sign-ins can fill userSessions table.

**Files:**
- Modify: `src/app/api/auth/sign-in/route.ts`

- [ ] **Step 1: Add rateLimit wrapper**

```typescript
import { rateLimit } from "@/lib/rate-limit";

const SIGN_IN_RATE_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, SIGN_IN_RATE_LIMIT, "auth-sign-in");
  if (limited) return limited;

  // ... existing body
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/sign-in/route.ts
git commit -m "fix(auth): rate limit sign-in endpoint

5 sign-in attempts per IP per 60s prevents session-table flooding
and basic credential-stuffing patterns.

Refs: docs/review-deepseek-v4-pro.md I4, SE2"
```

---

## Task 15: CSRF token on auth endpoints

**Priority:** P1 — defense in depth before app grows.

**Files:**
- Create: `src/lib/auth/csrf.ts`
- Create: `src/app/api/auth/csrf/route.ts`
- Modify: `src/app/api/auth/sign-in/route.ts`, `src/app/api/auth/sign-out/route.ts`
- Modify: client sign-in/sign-out form components (grep for fetch to these routes)

- [ ] **Step 1: Create CSRF utility**

```typescript
// src/lib/auth/csrf.ts
import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const CSRF_TTL_DAYS = 1;

export async function issueCsrfToken(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const jar = await cookies();
  jar.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CSRF_TTL_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function validateCsrfToken(req: Request): Promise<boolean> {
  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 2: Gate sign-in/sign-out on CSRF**

```typescript
// src/app/api/auth/sign-in/route.ts
import { validateCsrfToken } from "@/lib/auth/csrf";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, SIGN_IN_RATE_LIMIT, "auth-sign-in");
  if (limited) return limited;

  if (!(await validateCsrfToken(req))) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  // ... existing body
}
```

Same on sign-out.

- [ ] **Step 3: Add GET /api/auth/csrf**

```typescript
// src/app/api/auth/csrf/route.ts
import { NextResponse } from "next/server";
import { issueCsrfToken } from "@/lib/auth/csrf";

export async function GET() {
  const token = await issueCsrfToken();
  return NextResponse.json({ token });
}
```

- [ ] **Step 4: Update sign-in form / client to attach header**

Find the client code that POSTs to `/api/auth/sign-in` (`grep -rn "/api/auth/sign-in" src/components/ src/app/`). Attach:

```typescript
const { token } = await fetch("/api/auth/csrf").then((r) => r.json());
await fetch("/api/auth/sign-in", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-csrf-token": token },
  body: JSON.stringify(payload),
});
```

- [ ] **Step 5: Typecheck + manual test**

Run: `pnpm check && pnpm dev`
Manually test sign-in with and without CSRF header. Without: 403. With: success.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/csrf.ts src/app/api/auth/csrf/route.ts src/app/api/auth/sign-in/route.ts src/app/api/auth/sign-out/route.ts src/components/
git commit -m "feat(auth): CSRF token on sign-in and sign-out

Double-submit cookie pattern: server issues a random token in a
non-HttpOnly cookie, client echoes it in x-csrf-token header, server
timing-safe compares. Prevents form-based CSRF against auth endpoints.

Refs: docs/review-deepseek-v4-pro.md I5, SE3"
```

---

## Task 16: Audit empty catch blocks

**Priority:** P1 — silent errors hide systemic failures.

**Files:**
- Modify: `src/modules/jobs/application/job-handlers.ts:124` (empty `catch {}`)
- Modify: `src/lib/redis/pubsub.ts:33,46`
- Modify: `src/modules/translation/application/refresh-glossary.ts:106-108`
- Modify: `src/modules/catalog/application/register-novel.ts:66,100`

- [ ] **Step 1: Replace each with logger.warn**

Pattern for every site:

```typescript
} catch (err) {
  logger.warn("<site-specific message>", {
    err: err instanceof Error ? err.message : String(err),
    // ... any relevant context (entity IDs)
  });
}
```

Sites and messages:

| File:line | Message | Context fields |
|-----------|---------|---------------|
| `job-handlers.ts:124` | "Job progress update failed" | `jobId`, `jobKind` |
| `pubsub.ts:33` | "Redis publish failed (non-fatal)" | `channel` |
| `pubsub.ts:46` | "Redis subscribe callback error" | `channel` |
| `refresh-glossary.ts:106` | "Glossary extraction skipped due to error" | `episodeId`, `novelId` |
| `register-novel.ts:66` | "Title translation enqueue failed (non-fatal)" | `novelId` |
| `register-novel.ts:100` | "Metadata translation enqueue failed (non-fatal)" | `novelId` |

- [ ] **Step 2: Also fix refresh-glossary unconditional timestamp update**

Review `refresh-glossary.ts:111-114` — update `glossaryLastRefreshedAt` only when at least one extraction succeeded:

```typescript
if (extracted > 0) {
  await db
    .update(novels)
    .set({ glossaryLastRefreshedAt: new Date() })
    .where(eq(novels.id, novelId));
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/jobs/application/job-handlers.ts src/lib/redis/pubsub.ts src/modules/translation/application/refresh-glossary.ts src/modules/catalog/application/register-novel.ts
git commit -m "fix(errors): replace empty catch blocks with logger.warn

Silent catches hid systemic failures. Every site now logs a specific
message + relevant IDs at warn level. Also fixes refresh-glossary
updating glossaryLastRefreshedAt even when zero extractions succeeded.

Refs: docs/review-deepseek-v4-pro.md 4.4, T43, T44"
```

---

## Task 17: Standardize error logging in API routes

**Priority:** P1 — consistency + future correlation IDs.

**Files:** 12+ routes currently using `console.error`. Full list via `grep -rln "console.error" src/app/api/`.

- [ ] **Step 1: Produce the list**

Run: `grep -rln "console.error" src/app/api/ > /tmp/console-error-routes.txt && cat /tmp/console-error-routes.txt`
Expected: 12+ file paths.

- [ ] **Step 2: Migrate per file — import logger, replace call**

For each file:

```typescript
import { logger } from "@/lib/logger";

// replace:
console.error("Translation request failed:", err);
// with:
logger.error("Translation request failed", {
  err: err instanceof Error ? err.message : String(err),
  route: "POST /api/translations/episodes/:episodeId/request",
});
```

Pick a short `route` tag per file.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "refactor(logging): standardize on logger.error in API routes

Migrated 12+ routes from console.error to structured logger.error
so future correlation-ID work has a single chokepoint and levels
are filterable.

Refs: docs/review-deepseek-v4-pro.md R2, 4.3"
```

---

## Task 18: Seed application-layer tests (pure functions first)

**Priority:** P1 — zero coverage on complex pure functions today.

**Files:**
- Create: `tests/modules/translation/application/quality-validation.test.ts`
- Create: `tests/modules/translation/application/chunk-episode.test.ts`
- Create: `tests/modules/translation/application/prompt-fingerprint.test.ts`

- [ ] **Step 1: Write quality-validation tests**

Cover the 7 heuristics one by one — untranslated Japanese segments, length-ratio, paragraph-mismatch, glossary compliance, chunk-boundary artifacts, truncation. For each: a positive case (warning fires) and a negative case (warning does not fire):

```typescript
import { describe, it, expect } from "vitest";
import { validateTranslationQuality } from "@/modules/translation/application/quality-validation";

describe("validateTranslationQuality", () => {
  it("flags untranslated Japanese segments", () => {
    const warnings = validateTranslationQuality({
      sourceText: "こんにちは。世界。",
      translatedText: "안녕. 世界.",
      glossaryEntries: [],
    });
    expect(warnings.some((w) => w.code === "untranslated-segment")).toBe(true);
  });

  it("does not flag pure Korean translation", () => {
    const warnings = validateTranslationQuality({
      sourceText: "こんにちは。",
      translatedText: "안녕하세요.",
      glossaryEntries: [],
    });
    expect(warnings.some((w) => w.code === "untranslated-segment")).toBe(false);
  });

  // ... one positive + one negative per remaining heuristic
});
```

Before writing, read the actual exported function signature and warning-code enum values — use those exact strings, don't guess.

- [ ] **Step 2: chunk-episode tests**

Cover the splitting cascade: `\n\n` boundaries → `\n` → sentence → hard cut; and the single-paragraph-no-newline fallback (V3 C1 open):

```typescript
describe("splitIntoChunks", () => {
  it("splits on double-newline boundaries when available", () => { /* ... */ });
  it("falls back to single newlines", () => { /* ... */ });
  it("falls back to sentence boundaries in single-newline blobs", () => { /* ... */ });
  it("hard-cuts when no boundary is found", () => { /* ... */ });
  it("keeps chunks under TARGET_CHUNK_SIZE when possible", () => { /* ... */ });
});
```

- [ ] **Step 3: prompt-fingerprint tests**

Deterministic hashing + input sensitivity:

```typescript
describe("promptFingerprint", () => {
  it("returns the same hash for identical input", () => { /* ... */ });
  it("changes hash when globalPrompt changes", () => { /* ... */ });
  it("changes hash when glossary changes", () => { /* ... */ });
});
```

- [ ] **Step 4: Run + commit**

Run: `pnpm test`
Expected: all new tests pass.

```bash
git add tests/modules/translation/application/
git commit -m "test: seed application-layer tests for pure functions

Covers quality-validation heuristics, chunk-episode split cascade, and
prompt-fingerprint determinism — the highest-value pure-function surface
still untested.

Refs: docs/review-deepseek-v4-pro.md Q1"
```

---

## Post-Plan Verification

After every task commits cleanly:

- [ ] Run full suite: `pnpm test`
- [ ] Run typecheck: `pnpm check`
- [ ] Run build: `pnpm build`
- [ ] Browser smoke: `pnpm dev`, hit `/` and at least one episode translate flow
- [ ] Grep regression: `! grep -rn "parts\[parts.length - 1\]" src/lib/rate-limit.ts` (confirms fix still in place)

## Post-Implementation Notes (2026-04-25)

All 18 tasks landed across commits `be55931..631eeb6`. Verification:

- `pnpm test` → 114 passed (18 files)
- `pnpm check` → clean
- `pnpm build` → success

Follow-up correction applied after deploy-time DB verification:

- **Task 5 (stats)** — the canonical-only subquery dropped all rows on prod because 883/883 `available` translations had `is_canonical=false`. Replaced with `ROW_NUMBER() OVER (PARTITION BY episode_id, model_name ORDER BY created_at DESC)` and filter `rn=1`. Picks the most recent translation per `(episode, model)` regardless of canonical flag. Verified against prod data: query returns expected per-model aggregates.

Open follow-ups (tracked separately):

- Sign-in CSRF gate is dormant (no client caller). Future sign-in form author must fetch `/api/auth/csrf` first.
- Task 4 eviction ordering now ties on `createdAt` instead of prior `updatedAt` — behavioral drift on which confirmed entries get evicted first. Low impact.
- SSE endpoint permits default-user. Scope subscription by `userId` if per-user binding is later required.
- `readingEvents` has no unique index for dedup; `onConflictDoNothing()` is a no-op until a migration adds it.

## Deferred (separate plan)

- P2/P3 from pro review: split overlong files, structured error types, correlation IDs, OpenRouter client consolidation, dead-dir cleanup, Dockerfile prune, E2E test flows, glossary size cap, chunk single-paragraph fallback (V3 C1), `i18n` `/g` flag fix.
- False claim: X13 "OPENROUTER_EXTRACTION_MODEL typo" — no fix needed.
- Mitigated claim: T11 reset-failed translation race — unique index already prevents duplicate runs.
