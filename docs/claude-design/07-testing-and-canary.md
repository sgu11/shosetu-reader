# Testing + canary

## Fixture-based parser tests

Each adapter has fixture-based tests committed under
`tests/modules/source/infra/fixtures/{site}/`. Snapshots are real responses
from the upstream pulled during phase 4–5 development.

| File | What |
|---|---|
| `tests/modules/source/infra/syosetu-api.test.ts` | Original; mocks `fetch` with inline JSON constants. Untouched by the refactor — passes against the parameterized `syosetu-api.ts`. |
| `tests/modules/source/infra/episode-scraper.test.ts` | Original; updated to pass a URL builder to `parseToc` since the function now accepts a callback instead of an ncode. |
| `tests/modules/source/infra/registry.test.ts` | New. Asserts `getAdapter` for each registered site, `parseInput` priority, `listEnabledSites`. |
| `tests/modules/source/infra/nocturne-adapter.test.ts` | New. Mocks fetch and asserts the `over18=yes` cookie + `novel18api/api/` URL. Bare ncode rejection. |
| `tests/modules/source/infra/kakuyomu-adapter.test.ts` | New. Reads committed `fixtures/kakuyomu/{work,episode,ranking-daily}.html`, parses Apollo state, walks TOC, asserts adult flag aggregation, episode body, ranking parser. |
| `tests/modules/source/infra/alphapolis-adapter.test.ts` | New. Reads `fixtures/alphapolis/{work,episode,episode-body,ranking-hot}.html`, asserts the body parser handles `<br><br>` paragraph breaks + ruby `<rt>` stripping. |
| `tests/modules/catalog/application/adult-filter.test.ts` | New. Anonymous (null ctx) → SFW; off → SFW; on → all. |

Tests run as `pnpm test` (vitest). 173 tests across 27 files green at every
phase boundary.

## Live-fetch canary

`scripts/canary-source-fetch.ts`. Designed to catch upstream HTML / Apollo
schema drift that ships green CI but breaks production.

```
pnpm canary
```

Probes:

| Probe | Asserts |
|---|---|
| `kakuyomu.fetchNovelMetadata(stable-id)` | non-empty title + author; episodes count plausible |
| `kakuyomu.fetchRanking(daily)` | ≥1 item; every item has id + title |
| `alphapolis.fetchNovelMetadata(stable-id)` | non-empty title + author; episodes count plausible |
| `alphapolis.fetchRanking(hot)` | ≥1 item; every item has id + title |

Output is one line per probe (ok/FAIL) plus a final aggregate:

```
[canary] ok kakuyomu.fetchNovelMetadata(16816452221074480581) (1125ms): title="クラスメイトは異世界転移なのに私は異世界転生" episodes=412
[canary] ok kakuyomu.fetchRanking(daily) (824ms): 5 items, top="失敗した僕は周りを曇らせる"
[canary] ok alphapolis.fetchNovelMetadata(101715426/813048051) (598ms): title="追放された修理師の辺境修復喫茶〜極致修復でガラクタを新品以上" episodes=31
[canary] ok alphapolis.fetchRanking(hot) (744ms): 5 items, top="誰にも見えない自分専用ダンジョンでレベル上げしてたら世界ラン"
[canary] all 4 probe(s) passed
```

Failures exit non-zero and print the offending probe + error message so a
scheduled cron / GH Actions schedule can alert.

### Suggested deploy

Run **out-of-band**, not as a PR gate. Network flakes shouldn't block merges.
Daily cron (1×/day) is plenty — picks up upstream regressions inside 24h.

```yaml
# .github/workflows/canary-source-fetch.yml
on:
  schedule:
    - cron: "0 9 * * *"  # 09:00 UTC
  workflow_dispatch:

jobs:
  canary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm canary
```

The probes don't need a database, so the workflow doesn't need PG. Failure
opens an issue via the standard GH Actions notification path.

## Why fixtures + canary, not one or the other

Fixtures alone catch parser regressions but are by definition frozen in
time — they will never tell you the upstream changed. Canary alone catches
drift but is network-dependent and flaky. Both together: fixtures gate PRs,
canary alerts on drift, drift then gets fixed by adding/refreshing fixtures
+ updating the parser.
