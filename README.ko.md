# Shosetu Reader

[English](README.md) · **한국어**

[Syosetu](https://syosetu.com/)의 일본어 웹소설을 JP→KR 번역과 함께 읽는
모듈러 모놀리식 리딩 플랫폼입니다. Next.js, PostgreSQL, Redis 기반 백그라운드
작업, OpenRouter를 조합해 번역 중심의 읽기 경험을 제공합니다.

## 현재 상태

- V1–V4는 구현 완료, 요약은 [docs/progress.md](docs/progress.md) 참고.
- 2026-04-14에 V4 강화·성능·비용 관리 작업 배포 완료.
- V5는 품질 경고 UI, 선택적 재수집, 읽기 통계, SSE, 오프라인 지원, EPUB
  내보내기 등 새 기능을 다루는 진행 중인 계획 트랙.
- 2026-04-24 지연·캐싱 개선: 외부 fetch 타임아웃, `translations` 복합 인덱스,
  모델 캐시 stale-while-revalidate, 공유 pub/sub 소켓 + 채널별 refcount,
  대량 번역 진행률 기록 스로틀링, 공용 카탈로그 GET에 HTTP `Cache-Control`
  추가. 자세한 내용은 아래 성능 섹션 참고.

## 기능

- Syosetu URL 또는 ncode로 **소설 등록**
- 일괄 수집, 전체 수집, 전체 재수집 백그라운드 작업을 통한 **에피소드 수집**
- JA/KR 토글, 기기별 폰트·레이아웃 설정, 스크롤 복원이 있는 **웹 리더**
- OpenRouter 기반 **번역 파이프라인** — 모델 선택, 재시도, 재번역, 폐기,
  세션 중단 지원
- 구조화된 용어집, 에피소드 간 컨텍스트 연결, 적응형 청킹, 품질 검증을
  포함한 **V3 번역 엔진**
- 수집·번역 진행 상태의 **라이브 에피소드 업데이트**
- 모델별 분류와 소설/에피소드 단위 폐기가 가능한 **번역 인벤토리**
- 게스트 데이터 이관, 사용자별 설정·라이브러리·진행도가 있는 **멀티유저 프로필**
- 구독, 진행도 추적, 이어 읽기, 상태 요약이 있는 **개인 라이브러리**
- Syosetu에서 가져오는 **랭킹 탐색** (일간/주간/월간/분기)
- 쿠키 기반 로캘 유지가 있는 **영·한 이중 언어 UI**
- 번역 에피소드에서 자동 추출되는 **소설별 용어집·스타일 가이드**
- 번역, 용어집 생성, 용어 추출, 세션 집계에 걸친 **비용 추적**
- 설정한 임계치 초과 시 번역 세션을 자동 일시 중지하는 **비용 예산 관리**
- 작업 상태, 큐 지표, 번역 품질, 모델 처리량용 **운영 API**
- Supabase 스타일의 **다크/라이트/시스템 테마**

## 성능

앱이 의존하는 지연·캐싱 보장:

- **fetch 타임아웃** — 외부 호출(OpenRouter chat/models, Syosetu API 및
  HTML 스크레이퍼)은 전부 `AbortSignal.timeout` 사용. 상류 장애가 워커를
  잠그지 못하게 함. 호출별로 튜닝: 메타데이터 15–30 초, 번역 120–180 초.
- **OpenRouter 모델 캐시** — Redis 기반 1 시간 TTL. stale-while-revalidate
  패턴으로 staleness를 즉시 반환하면서 단일 인플라이트 refresh가 캐시를
  재채움. 부팅 시 `src/instrumentation.ts`가 프로세스 메모리로 pre-warm.
- **공유 pub/sub 소켓** — SSE 구독자들이 Redis 구독 연결 하나를 공유하고
  채널별 핸들러를 refcount 관리. 브라우저가 강제로 연결을 끊을 때 탭당
  소켓 누수 현상을 방지.
- **대량 번역 진행률 스로틀링** — `translation.bulk-translate-all`이
  에피소드마다가 아니라 약 1 % 단위(최소 500 ms 간격)로 진행률을 기록해
  DB 쓰기를 O(N)에서 O(100)로 줄임.
- **제목 번역 병렬화** — `translateTexts`가 직렬 루프 대신 3개 동시성
  상한으로 배치를 실행.
- **공용 GET에 HTTP 캐싱** — `/api/openrouter/models`와 `/api/ranking`이
  `Cache-Control: public, s-maxage=300, stale-while-revalidate=1800`을
  반환해 CDN·브라우저가 반복 호출을 흡수.
- **`translations(target_language, status, episode_id)` 복합 인덱스** —
  라이브러리와 소설 페이지가 사용하는 상태 요약 조인을 커버. 동일한
  데이터에 대한 중복 비용 집계 쿼리는 제거하고 모델별 rollup에서 앱
  레벨로 합산.

## 스택

- **프레임워크**: Next.js 16 (App Router) + TypeScript
- **스타일링**: Tailwind CSS 4 (다크 모드 네이티브)
- **데이터베이스**: Drizzle ORM + PostgreSQL
- **큐**: Redis 기반 내구성 작업 큐 + 전용 워커
- **번역**: OpenRouter (OpenAI 호환) JP→KR
- **검증**: Zod
- **테스트**: Vitest + Playwright smoke
- **배포**: Docker Compose
- **패키지 매니저**: pnpm

## 빠른 시작 (로컬)

```bash
cp .env.example .env    # DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY 입력
pnpm install
pnpm db:migrate
pnpm dev                # http://localhost:3000
pnpm worker             # 백그라운드 작업 워커
```

로컬 개발은 `.env` 값과 일치하는 PostgreSQL·Redis가 `localhost`에서 실행
중이라고 가정합니다. 비동기 수집·번역 흐름은 워커 프로세스가 필요합니다.

## 프로덕션 (Docker)

```bash
cp .env.example .env.production   # 비밀값 입력
docker compose up -d --build      # app + worker + db + redis, port 3000
```

마이그레이션은 컨테이너 시작 시 자동 실행됩니다.

## 명령어

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 시작 (Turbopack) |
| `pnpm worker` | 백그라운드 작업 워커 시작 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 시작 |
| `pnpm lint` | ESLint 실행 |
| `pnpm typecheck` | TypeScript 검사 |
| `pnpm check` | lint + typecheck |
| `pnpm test` | Vitest 실행 |
| `pnpm test:watch` | Vitest watch 모드 |
| `pnpm dev:verify` | check, test, build을 묶어 실행 |
| `pnpm dev:smoke` | 실행 중인 앱에 HTTP 스모크 |
| `pnpm test:browser` | Playwright 브라우저 스모크 |
| `pnpm dev:loop` | 전체 로컬 검증 루프 |
| `pnpm db:generate` | Drizzle 마이그레이션 생성 |
| `pnpm db:migrate` | 마이그레이션 적용 |
| `pnpm db:studio` | Drizzle Studio 열기 |

## 프로젝트 구조

```text
src/
  app/              Next.js App Router 페이지 및 API 라우트
  components/       공용 React 컴포넌트
  features/         기능 단위 슬라이스 (현재 비어 있음)
  lib/              공용 인프라 (db, i18n, auth, rate-limit, cache, redis)
  modules/          도메인 모듈 (모듈러 모놀리스)
    source/         Syosetu API/HTML 연동
    catalog/        소설·에피소드 도메인
    library/        구독, 진행도, 이어 읽기
    translation/    번역 파이프라인 (OpenRouter)
    reader/         리더 콘텐츠 조립
    identity/       사용자, 세션, 환경설정
    jobs/           백그라운드 작업 오케스트레이션 (Redis 큐 + 워커)
    admin/          운영 가시성
  styles/           공용 Tailwind/CSS 자원
tests/              Vitest 및 Playwright 커버리지
drizzle/            SQL 마이그레이션 파일
docs/               아키텍처, 디자인, 검증, 기획 문서
```

## API 개요

| 분류 | 엔드포인트 |
|------|-----------|
| **탐색** | `POST /api/novels/register`, `GET /api/ranking`, `POST /api/ranking/translate-titles` |
| **소설 & 에피소드** | `GET /api/novels/[id]`, `GET .../episodes`, `POST .../ingest`, `POST .../ingest-all`, `POST .../reingest-all`, `GET .../live-status` |
| **번역** | `POST .../bulk-translate`, `POST .../bulk-translate-all`, `POST .../translate-session/abort`, `DELETE /api/novels/[id]/translations/discard` |
| **에피소드별** | `POST .../request`, `GET .../status`, `DELETE .../discard` |
| **용어집** | `GET/PUT/POST .../glossary`, `GET/POST .../entries`, `PUT/DELETE .../entries/[id]`, `POST .../entries/import` |
| **라이브러리** | `GET /api/library`, `POST/DELETE .../subscribe`, `PUT /api/progress` |
| **아이덴티티** | `POST /api/auth/sign-in`, `POST .../sign-out`, `GET .../session`, `GET/POST /api/profiles`, `GET/PUT/DELETE .../active` |
| **리더 & 설정** | `GET /api/reader/episodes/[id]`, `GET/PUT /api/settings`, `GET/PUT /api/translation-settings`, `GET /api/openrouter/models` |
| **운영** | `GET /api/health`, `GET .../jobs`, `GET .../metrics`, `GET/POST .../scheduled`, `GET .../translations`, `GET .../translations/quality`, `GET .../translations/trends` |
| **작업** | `GET /api/jobs/[id]`, `GET /api/novels/[id]/jobs/current` |

## 페이지

| 페이지 | 설명 |
|--------|------|
| 홈 | 히어로 + 이어 읽기 |
| 라이브러리 | 구독 소설, 상태 배지, 신규 에피소드 노출 |
| 랭킹 | 일/주/월/분기 Syosetu 탐색 |
| 등록 | URL 또는 ncode 입력 |
| 소설 상세 | 에피소드 목록, 라이브 업데이트, 용어집 에디터, 번역 인벤토리, 일괄 작업 |
| 리더 | JA/KR 토글, 모델 전환, 폰트 설정, 진행도 추적 |
| 설정 | 로캘, 테마, 번역 모델, 전역 프롬프트 기본값 |
| 프로필 | 생성, 전환, 게스트 데이터 이관 |
| 로그인 | 경량 아이덴티티 엔트리 포인트 |

## 문서

아키텍처·기획 문서는 [`docs/`](docs/) 참고:

- [V1 Goal](docs/v1-goal.md) — 제품 요구사항 및 수락 기준
- [V1 Architecture](docs/v1-architecture.md) — 시스템 설계
- [V1 Design](docs/v1-design.md) — UX 및 인터랙션 패턴
- [V1 Design Style](docs/v1-design-style.md) — Supabase 스타일 비주얼 시스템
- [V2 Architecture](docs/v2-architecture.md) — 멀티유저, 내구성 작업, 라이브 업데이트
- [V3 Architecture](docs/v3-architecture.md) — 용어집, 컨텍스트 체이닝, 품질 검증
- [V3 Review](docs/v3-review.md) — 구현 후 리뷰 및 후속 과제
- [V4 Plan](docs/v4-plan.md) — 강화, 성능, 비용 관리 작업
- [V5 Plan](docs/v5-plan.md) — 신규 기능 로드맵
- [Dev Loop Harness](docs/dev-loop-harness.md) — 로컬 검증·스모크 워크플로
- [Progress](docs/progress.md) — 모든 단계의 현재 구현 상태

## 라이선스

[MIT](LICENSE)
