# API + caching

## `GET /api/ranking`

Two-mode endpoint:

| Query | Behavior | Cache |
|---|---|---|
| `?period=daily&scope=syosetu` (no scope ≈ same) | Legacy single-list path: `getRanking` → `{ items: RankingItem[] }`. Backwards-compatible with the old client. | `public, s-maxage=300, stale-while-revalidate=1800` |
| `?period=…&scope=sfw\|all\|<site>` | Multi-source fan-out: `getRankingSections` → `{ sections: RankingSection[] }`. | `private, max-age=60, stale-while-revalidate=300, Vary: Cookie` |

`RankingSection` shape:

```ts
{
  site: SourceSite;
  status: "ok" | "timeout" | "error";
  errorMessage: string | null;
  items: RankingSectionItem[];
}
```

The status field lets the UI render skeletons + retry for degraded sources
without failing the whole page. `Promise.allSettled` + an 8-second per-section
timeout means one slow upstream (alphapolis is the usual suspect) doesn't
hang the response.

### Period validation

The route validates against the **union** of all supported periods, then the
adapter normalizes: `getRankingSections` falls back to
`adapter.supportedPeriods[0]` when the requested period isn't supported by
the adapter. So `?scope=alphapolis&period=daily` returns alphapolis's `hot`
data rather than a 400.

### Scope validation

`scope ∈ {sfw, all, syosetu, nocturne, kakuyomu, alphapolis}`. `sfw`
filters out all `isAdult: true` adapters; `all` gates on the user's
`adultContentEnabled` (anonymous → SFW even when `all` requested); a specific
site name returns just that section, but adult sites on anonymous sessions
return empty.

## `POST /api/novels/register`

Dispatches via `parseInput` from the registry. The route handler is now
source-agnostic:

```ts
const parsed = registerNovelInputSchema.safeParse(body);
if (!parsed.success) return 400;
const result = await registerNovel(parsed.data.id, parsed.data.site);
```

`registerNovelInputSchema` is the Zod schema in `src/modules/source/api/schemas.ts` that wraps `parseInput`. Accepted formats:

| Input | Resolves to |
|---|---|
| `https://ncode.syosetu.com/n9669bk/` | `{site: "syosetu", id: "n9669bk"}` |
| `https://novel18.syosetu.com/n5555aa/` | `{site: "nocturne", id: "n5555aa"}` |
| `https://kakuyomu.jp/works/8221…` | `{site: "kakuyomu", id: "8221…"}` |
| `https://www.alphapolis.co.jp/novel/101715426/813048051` | `{site: "alphapolis", id: "101715426/813048051"}` |
| `n9669bk` | `{site: "syosetu", id: "n9669bk"}` |
| `101715426/813048051` | `{site: "alphapolis", id: "101715426/813048051"}` |
| `1177354054887670557` | `{site: "kakuyomu", id: "1177354054887670557"}` (URL form preferred) |

## `GET /api/settings` and `PUT /api/settings`

GET returns `{ locale, readerLanguage, theme, adultContentEnabled }`. PUT
accepts any subset; `adultContentEnabled` upserts into `reader_preferences`.
Anonymous user (no profile cookie) operates on the default user row, so the
toggle state persists per-machine via the cookie-based profile.

## Adult-gate placement

Always at the application layer, never registry or per-route:

```
HTTP request
  ↓
route handler resolves active profile cookie → userId | null
  ↓
resolveAdultContext(userId): AdultFilterContext | null
  ↓
getRanking / getRankingSections / getNovel / getReaderPayload / library list
  ↓
filterAdultContent(items, ctx)
```

`ctx === null` → SFW only (anonymous). `ctx.adultContentEnabled === false` →
SFW only. `ctx.adultContentEnabled === true` → all sites.

## Cache strategy rationale

The fragmenting reviewer feedback was: don't have an anonymous-`all` cache
class. Reasons:

- Anonymous users are always SFW, so the only public cache class is the
  syosetu+legacy-period path. That stays exactly as it was — same headers,
  same key.
- Authenticated users have per-profile filtering. Public CDN caches can't
  segment by profile cookie cheaply, so we mark it `private` and let the
  browser cache for 60 seconds with SWR.
- `Vary: Cookie` ensures any intermediate proxy that does honor `private`
  still segments by profile cookie.

This avoids the leak scenario: "user A toggles adult-on, requests `?scope=all`,
the response gets cached publicly, user B (anonymous) hits the same URL and
gets adult content."
