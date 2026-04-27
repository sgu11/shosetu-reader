# Per-adapter notes

## Syosetu — `syosetuAdapter`

Files: `syosetu-api.ts`, `episode-scraper.ts`, `syosetu-family.ts`, `syosetu-adapter.ts`.

Wraps the existing JSON API client + HTML episode scraper behind the family
factory. **Refactor only**: every existing test continued to pass without
modification once the adapter was wired.

```ts
syosetuAdapter = createSyosetuFamilyAdapter({
  site: "syosetu",
  isAdult: false,
  novelHost: "https://ncode.syosetu.com",
  apiBase: "https://api.syosetu.com/novelapi/api/",
  urlHost: "ncode.syosetu.com",
});
```

- API: `api.syosetu.com/novelapi/api/` returns a normalized array
  (`[{allcount}, ...rows]`) parsed by the existing Zod schema.
- TOC: `<a class="p-eplist__subtitle">` on the novel page; pagination via
  `?p=N` until `<a.c-pager__item--last>` is absent or N is reached.
- Episode body: `.p-novel__text` excluding `--preface` / `--afterword`
  modifier classes, with separate preface/afterword sections retained.
- Bare ncode → syosetu by default.

## Nocturne — `nocturneAdapter`

Files: same as syosetu, plus `nocturne-adapter.ts`. **90% reuse** of the
syosetu code via the family factory:

```ts
nocturneAdapter = createSyosetuFamilyAdapter({
  site: "nocturne",
  isAdult: true,
  novelHost: "https://novel18.syosetu.com",
  apiBase: "https://api.syosetu.com/novel18api/api/",
  cookieHeader: "over18=yes",
  urlHost: "novel18.syosetu.com",
});
```

Operational notes:
- Forwards `Cookie: over18=yes` on every outbound fetch. Without it, the
  novel18 hosts redirect to a "are you 18+?" interstitial that returns 200
  but with no novel content.
- URL host disambiguates from syosetu; bare ncode never resolves to nocturne
  (ncode regex matches both namespaces, so URL form is required).
- Shares the syosetu host bucket — both hit `api.syosetu.com`, so the
  combined budget is still ≤1 req/s.

## Kakuyomu — `kakuyomuAdapter`

Files: `kakuyomu-adapter.ts`, `kakuyomu-apollo.ts`. Most complex adapter.

### Metadata + TOC: `__APOLLO_STATE__`

Work + episode pages embed `<script id="__NEXT_DATA__" type="application/json">`. The slice we care about is `props.pageProps.__APOLLO_STATE__` — a normalized cache keyed by `{__typename}:{id}`. The work-page parser walks:

```
ROOT_QUERY.work({"id":"822139845727270228"})  ──ref──▶
  Work:822139845727270228                       ──read──▶ title, summary, isCruel/isViolent/isSexual, …
    .author                                     ──ref──▶
      UserAccount:822139845727117210            ──read──▶ activityName / name
    .tableOfContentsV2[]                        ──ref──▶
      TableOfContentsChapter:…                  ──read──▶ episodeUnions[], chapter
        .chapter                                ──ref──▶ Chapter:… (chapter title)
        .episodeUnions[]                        ──ref──▶
          Episode:…                             ──read──▶ id, title, publishedAt
```

Every entity schema uses Zod `.passthrough()` and `.nullish()` on every
non-required field. Only six fields are actually load-bearing (title,
introduction, episode list, episode body, chapter title, author display
name) — everything else can disappear without breaking parsing.

### Episode body

`.widget-episodeBody` paragraphs (`<p id="p1">…<p id="pN">`) — same shape as
the modern syosetu HTML, just without the preface/afterword sections. Title
from `.widget-episodeTitle`.

### Ranking

`/rankings/all/{period}?work_variation=long` is **not** Next.js — it's a
legacy SSR template. Parsed directly with cheerio: `.widget-workCard-title
a.widget-workCard-titleLabel` href + author. Returns shallow `NovelMetadata`
(no episode count, no completion status) since the full data only exists on
the work page; ranking just provides the ID + title for UI display.

### Adult flag

Per-work, not per-site. `Work.isCruel || isViolent || isSexual` aggregates
into `KakuyomuWorkSnapshot.isAdult`. The adapter itself is `isAdult: false`
because most kakuyomu works are SFW.

## AlphaPolis — `alphapolisAdapter`

Files: `alphapolis-adapter.ts`, `alphapolis-body-parser.ts`. Heaviest QA load.

### Metadata + TOC

The novel page embeds `<script id="app-cover-data" type="application/json">`
with everything we need: title, author, episode list (with `episodeNo`,
`mainTitle`, `dispOrder`, `isPublic`, `chapterEpisodes[]`, etc.). Summary +
completion state come from the surrounding HTML (`.abstract`,
`.content-status complete | 連載中`).

### Episode body — the two-step CSRF flow

This is the only adapter that requires session state. Episode pages render
an empty `<div id="novelBody">` placeholder; content loads via JS.

After tracing the loader:

1. **GET** `https://www.alphapolis.co.jp/novel/{author}/{novel}/episode/{N}` — harvest:
   - per-page anti-scrape token from inline JS (`'token': '<hex>'`)
   - Laravel CSRF token from inline `$.ajaxSetup({headers: {'X-CSRF-TOKEN': '...'}})`
   - session cookies from `Set-Cookie` (jQuery `.load` is POST + session-bound)
   - episode title from `.episode-title`
2. **POST** `https://www.alphapolis.co.jp/novel/episode_body` with:
   - `Content-Type: application/x-www-form-urlencoded`
   - `X-CSRF-TOKEN: …`
   - `X-Requested-With: XMLHttpRequest`
   - `Referer: …` (the episode URL)
   - `Cookie: …` (forwarded session)
   - body: `episode={episodeNo}&token={hex}`
3. Response: HTML fragment with `<br>`-separated paragraphs.

Without the cookie + CSRF, the endpoint returns HTTP 419 ("page expired").

### Body parser

`alphapolis-body-parser.ts`. The fragment uses `<br>` for line breaks and
`<br><br>` for paragraph breaks (no `<p>` tags). Naive splitting breaks
sentences mid-flow because alphapolis uses ruby (`<ruby>漢字<rt>かんじ</rt>`)
that introduces phantom whitespace.

Algorithm:
1. Cheerio-load the fragment under a synthetic `<div id="root">` wrapper.
2. Drop `<rt>` and `<rp>` (ruby readings) — keep base text.
3. Replace every `<br>` with a sentinel string (`"BR"`).
4. Serialize text, normalize NBSP, split on `BR{2,}` for paragraph breaks,
   then on single `BR` for in-paragraph newlines.

Output is paragraph-shaped `normalizedText` so the existing translation
chunker isn't fed half-sentences.

### Ranking

`/novel/ranking/hot` HTML scrape, top 20. Composite IDs are extracted from
`/novel/{author}/{novel}` href patterns.

### Composite ID parsing

URL: `https://www.alphapolis.co.jp/novel/{authorId}/{novelId}` → `{authorId}/{novelId}`.
Bare paste: `^\d+/\d+$` accepted; bare 19-digit numeric resolves to kakuyomu, not alphapolis.
