export const dictionaries = {
  en: {
    // Nav
    "nav.home": "Home",
    "nav.library": "Library",
    "nav.ranking": "Ranking",
    "nav.register": "Register",
    "nav.addNovel": "Add novel",
    "nav.brand": "Shosetu Reader",

    // Home
    "home.title": "Shosetu Reader",
    "home.subtitle":
      "A calm reading environment for Japanese web novels from Syosetu, with resume flow and Korean translation.",
    "home.addNovel": "Add novel",
    "home.myLibrary": "My library",
    "home.continueReading": "Continue reading",

    // Register
    "register.title": "Register a novel",
    "register.subtitle": "Paste a Syosetu URL or enter an ncode to add a novel.",
    "register.placeholder": "https://ncode.syosetu.com/n1234ab/ or n1234ab",
    "register.submit": "Register",
    "register.submitting": "Registering...",
    "register.networkError": "Network error. Please try again.",
    "register.newlyRegistered": "Newly registered",
    "register.alreadyRegistered": "Already registered",
    "register.by": "by",
    "register.episodes": "episodes",
    "register.completed": "Completed",
    "register.ongoing": "Ongoing",
    "register.viewDetails": "View novel details",

    // Library
    "library.title": "Library",
    "library.subscribedNovel": "subscribed novel",
    "library.subscribedNovels": "subscribed novels",
    "library.empty": "Your library is empty.",
    "library.emptyAction": "Register a novel",
    "library.emptyHint": "and subscribe to start reading.",
    "library.eps": "eps",
    "library.completed": "Completed",
    "library.ongoing": "Ongoing",
    "library.ep": "Ep.",

    // Novel detail
    "novel.backToLibrary": "Library",
    "novel.completed": "Completed",
    "novel.ongoing": "Ongoing",
    "novel.by": "by",
    "novel.episodes": "episodes",
    "novel.synced": "Synced",
    "novel.viewOnSyosetu": "View on Syosetu",
    "novel.episodesHeading": "Episodes",
    "novel.noEpisodes":
      'No episodes ingested yet. Click "Ingest episodes" above to fetch them from Syosetu.',

    // Subscribe button
    "subscribe.subscribed": "Subscribed",
    "subscribe.subscribe": "Subscribe",

    // Ingest button
    "ingest.ingest": "Ingest episodes",
    "ingest.ingesting": "Ingesting...",
    "ingest.ingestAll": "Ingest all episodes",
    "ingest.ingestAllStarted": "Fetching all episodes in background ({discovered} new discovered)",
    "ingest.result": "Discovered {discovered} new episodes. Fetched {fetched}, failed {failed}.",
    "ingest.networkError": "Network error",
    "ingest.bulkTranslate": "Translate next {count}",
    "ingest.bulkTranslateAll": "Translate all episodes",
    "ingest.bulkTranslating": "Requesting translations...",
    "ingest.bulkTranslateResult": "{queued} translations queued",
    "ingest.bulkTranslateAllStarted": "Translating all {total} episodes in background",
    "ingest.bulkTranslateNone": "No untranslated episodes found",

    // Reader
    "reader.episodeList": "Episode list",
    "reader.previous": "Previous",
    "reader.next": "Next",
    "reader.noContent": "Episode content has not been fetched yet.",

    // Translation toggle
    "translation.translate": "Translate",
    "translation.translating": "Translating...",
    "translation.failedRetry": "Failed — retry",
    "translation.rateLimited": "Rate limited — try another model",
    "translation.retranslate": "Re-translate",
    "translation.selectModel": "Select translation",

    // Ranking
    "ranking.title": "Ranking",
    "ranking.subtitle": "Discover popular novels on Syosetu.",
    "ranking.daily": "Daily",
    "ranking.weekly": "Weekly",
    "ranking.monthly": "Monthly",
    "ranking.quarterly": "Quarterly",
    "ranking.loading": "Loading rankings...",
    "ranking.empty": "No ranking data available.",
    "ranking.eps": "eps",
    "ranking.completed": "Completed",
    "ranking.ongoing": "Ongoing",
    "ranking.view": "View",
    "ranking.register": "Register",
    "ranking.translatingTitles": "Translating titles...",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language",
    "settings.readerSettings": "Reader settings",
    "settings.fontFamily": "Font",
    "settings.fontWeight": "Weight",
    "settings.fontSize": "Font size",
    "settings.lineHeight": "Line height",
    "settings.contentWidth": "Content width",
    "settings.save": "Save",
    "settings.saving": "Saving...",
    "settings.saved": "Saved",
    "settings.translationConfig": "Configure translation model and prompts.",
    "settings.translationModel": "Translation model",
    "settings.translationModelDesc": "Select the OpenRouter model used for JP→KR translation.",
    "settings.currentModel": "Current model",
    "settings.searchModels": "Search models...",
    "settings.loadingModels": "Loading available models...",
    "settings.noModelsFound": "No models found.",
    "settings.refineSearch": "Showing first 50 results. Refine your search for more.",
    "settings.globalPrompt": "Global translation prompt",
    "settings.globalPromptDesc": "Additional instructions applied to all translations.",
    "settings.globalPromptPlaceholder": "Enter additional translation guidelines (e.g. honorific handling, style preferences)...",
    "settings.useDefault": "Use default",

    // Novel translation prompt
    "novelPrompt.title": "Translation prompt",
    "novelPrompt.subtitle": "Title-specific translation instructions (character names, tone, etc.)",
    "novelPrompt.placeholder": "e.g. Main character 田中 should be kept as 타나카. Use formal tone for narration.",

    // Nav
    "nav.settings": "Settings",

    // Locale names
    "locale.en": "English",
    "locale.ko": "한국어",
  },

  ko: {
    // Nav
    "nav.home": "홈",
    "nav.library": "서재",
    "nav.ranking": "랭킹",
    "nav.register": "등록",
    "nav.addNovel": "소설 추가",
    "nav.brand": "나로우 리더",

    // Home
    "home.title": "나로우 리더",
    "home.subtitle":
      "나로우 일본 웹소설을 위한 편안한 읽기 환경. 이어읽기와 한국어 번역 지원.",
    "home.addNovel": "소설 추가",
    "home.myLibrary": "내 서재",
    "home.continueReading": "이어서 읽기",

    // Register
    "register.title": "소설 등록",
    "register.subtitle": "나로우 URL을 붙여넣거나 ncode를 입력하세요.",
    "register.placeholder": "https://ncode.syosetu.com/n1234ab/ 또는 n1234ab",
    "register.submit": "등록",
    "register.submitting": "등록 중...",
    "register.networkError": "네트워크 오류. 다시 시도해 주세요.",
    "register.newlyRegistered": "새로 등록됨",
    "register.alreadyRegistered": "이미 등록됨",
    "register.by": "작가",
    "register.episodes": "화",
    "register.completed": "완결",
    "register.ongoing": "연재 중",
    "register.viewDetails": "소설 상세 보기",

    // Library
    "library.title": "서재",
    "library.subscribedNovel": "구독 소설",
    "library.subscribedNovels": "구독 소설",
    "library.empty": "서재가 비어있습니다.",
    "library.emptyAction": "소설을 등록",
    "library.emptyHint": "하고 구독하여 읽기를 시작하세요.",
    "library.eps": "화",
    "library.completed": "완결",
    "library.ongoing": "연재 중",
    "library.ep": "화",

    // Novel detail
    "novel.backToLibrary": "서재",
    "novel.completed": "완결",
    "novel.ongoing": "연재 중",
    "novel.by": "작가",
    "novel.episodes": "화",
    "novel.synced": "동기화",
    "novel.viewOnSyosetu": "나로우 사이트에서 보기",
    "novel.episodesHeading": "에피소드",
    "novel.noEpisodes":
      '에피소드가 아직 수집되지 않았습니다. 위의 "에피소드 수집" 버튼을 클릭하여 나로우에서 가져오세요.',

    // Subscribe button
    "subscribe.subscribed": "구독 중",
    "subscribe.subscribe": "구독",

    // Ingest button
    "ingest.ingest": "에피소드 수집",
    "ingest.ingesting": "수집 중...",
    "ingest.ingestAll": "전체 에피소드 수집",
    "ingest.ingestAllStarted": "백그라운드에서 전체 에피소드 수집 중 (신규 {discovered}화 발견)",
    "ingest.result": "새 에피소드 {discovered}화 발견. {fetched}화 수집, {failed}화 실패.",
    "ingest.networkError": "네트워크 오류",
    "ingest.bulkTranslate": "다음 {count}화 번역",
    "ingest.bulkTranslateAll": "전체 에피소드 번역",
    "ingest.bulkTranslating": "번역 요청 중...",
    "ingest.bulkTranslateResult": "{queued}화 번역 대기열 추가",
    "ingest.bulkTranslateAllStarted": "전체 {total}화 백그라운드 번역 시작",
    "ingest.bulkTranslateNone": "미번역 에피소드가 없습니다",

    // Reader
    "reader.episodeList": "에피소드 목록",
    "reader.previous": "이전",
    "reader.next": "다음",
    "reader.noContent": "에피소드 내용이 아직 수집되지 않았습니다.",

    // Translation toggle
    "translation.translate": "번역",
    "translation.translating": "번역 중...",
    "translation.failedRetry": "실패 — 재시도",
    "translation.rateLimited": "요청 제한 — 다른 모델로 시도",
    "translation.retranslate": "재번역",
    "translation.selectModel": "번역 선택",

    // Ranking
    "ranking.title": "랭킹",
    "ranking.subtitle": "나로우에서 인기 있는 소설을 찾아보세요.",
    "ranking.daily": "일간",
    "ranking.weekly": "주간",
    "ranking.monthly": "월간",
    "ranking.quarterly": "분기",
    "ranking.loading": "랭킹 불러오는 중...",
    "ranking.empty": "랭킹 데이터가 없습니다.",
    "ranking.eps": "화",
    "ranking.completed": "완결",
    "ranking.ongoing": "연재 중",
    "ranking.view": "보기",
    "ranking.register": "등록",
    "ranking.translatingTitles": "제목 번역 중...",

    // Settings
    "settings.title": "설정",
    "settings.language": "언어",
    "settings.readerSettings": "리더 설정",
    "settings.fontFamily": "글꼴",
    "settings.fontWeight": "굵기",
    "settings.fontSize": "글자 크기",
    "settings.lineHeight": "줄 간격",
    "settings.contentWidth": "콘텐츠 너비",
    "settings.save": "저장",
    "settings.saving": "저장 중...",
    "settings.saved": "저장됨",
    "settings.translationConfig": "번역 모델과 프롬프트를 설정합니다.",
    "settings.translationModel": "번역 모델",
    "settings.translationModelDesc": "JP→KR 번역에 사용할 OpenRouter 모델을 선택하세요.",
    "settings.currentModel": "현재 모델",
    "settings.searchModels": "모델 검색...",
    "settings.loadingModels": "사용 가능한 모델을 불러오는 중...",
    "settings.noModelsFound": "모델을 찾을 수 없습니다.",
    "settings.refineSearch": "처음 50개 결과를 표시 중입니다. 검색어를 더 구체적으로 입력하세요.",
    "settings.globalPrompt": "전체 번역 프롬프트",
    "settings.globalPromptDesc": "모든 번역에 적용되는 추가 지시사항입니다.",
    "settings.globalPromptPlaceholder": "추가 번역 가이드라인을 입력하세요 (예: 존댓말 처리, 문체 선호 등)...",
    "settings.useDefault": "기본값 사용",

    // Novel translation prompt
    "novelPrompt.title": "번역 프롬프트",
    "novelPrompt.subtitle": "작품별 번역 지시사항 (캐릭터명, 분위기 등)",
    "novelPrompt.placeholder": "예: 주인공 田中는 타나카로 유지. 내레이션은 격식체로 번역.",

    // Nav
    "nav.settings": "설정",

    // Locale names
    "locale.en": "English",
    "locale.ko": "한국어",
  },
} as const;

export type Locale = keyof typeof dictionaries;
export type TranslationKey = keyof (typeof dictionaries)["en"];
