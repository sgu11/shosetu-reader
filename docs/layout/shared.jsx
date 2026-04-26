/* ────────────────────────────────────────────────────────────────
   Shared bits used across all Narou Reader artboards.
   Components are exported to window so the per-screen JSX files can
   pick them up via Babel's separate-script-scope quirk.
   ──────────────────────────────────────────────────────────────── */

const { useState, useEffect, useRef, useMemo } = React;

/* Generated typographic cover. Title hashes into a hue so each novel
   gets a stable but distinct treatment. JP title is the visual hero. */
function NovelCover({ jp, kr, w = 92, h = 132, variant = 'paper', accent }) {
  const hash = useMemo(() => {
    let h = 0; for (const c of (jp || kr || '?')) h = (h * 31 + c.charCodeAt(0)) | 0;
    return Math.abs(h);
  }, [jp, kr]);
  const hue = hash % 360;
  const palette = variant === 'paper'
    ? {
        bg: `oklch(0.93 0.04 ${hue})`,
        ink: `oklch(0.28 0.04 ${(hue + 30) % 360})`,
        rule: `oklch(0.55 0.06 ${hue})`,
        sub: `oklch(0.45 0.04 ${hue})`,
      }
    : {
        bg: `oklch(0.18 0.03 ${hue})`,
        ink: `oklch(0.92 0.04 ${(hue + 30) % 360})`,
        rule: `oklch(0.65 0.08 ${hue})`,
        sub: `oklch(0.7 0.04 ${hue})`,
      };
  // pull short JP fragment for visual; bracket-strip
  const heroJp = (jp || '').replace(/[【】\[\]『』「」]/g, '').slice(0, 8);
  return (
    <div
      style={{
        width: w, height: h,
        background: palette.bg,
        color: palette.ink,
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: variant === 'paper'
          ? '0 1px 0 rgba(0,0,0,.06), 0 8px 18px -10px rgba(0,0,0,.25)'
          : '0 1px 0 rgba(255,255,255,.04), 0 8px 18px -10px rgba(0,0,0,.6)',
        fontFamily: 'var(--font-jp)',
        flexShrink: 0,
      }}
    >
      {/* deco rule */}
      <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 1, background: palette.rule, opacity: 0.4 }} />
      <div style={{ position: 'absolute', right: 6, top: 6, bottom: 6, width: 1, background: palette.rule, opacity: 0.4 }} />
      {/* tate-gaki JP hero */}
      <div style={{
        position: 'absolute', inset: 14,
        writingMode: 'vertical-rl',
        fontSize: Math.max(11, Math.min(w / 7, 16)),
        lineHeight: 1.15,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}>
        {heroJp || '無題'}
      </div>
      {/* corner mark */}
      <div style={{
        position: 'absolute', left: 8, bottom: 8,
        fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em',
        color: palette.sub,
      }}>
        n{(hash % 90000 + 10000)}
      </div>
    </div>
  );
}

/* Status pill */
function StatusPill({ kind = 'done', label, dark = false }) {
  const c = kind === 'done' ? 'var(--status-done)' : kind === 'queued' ? 'var(--status-queued)' : 'var(--status-failed)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
      padding: '3px 7px', borderRadius: 999,
      color: c,
      background: `color-mix(in oklab, ${c} ${dark ? 14 : 10}%, transparent)`,
      border: `1px solid color-mix(in oklab, ${c} 30%, transparent)`,
      letterSpacing: '0.02em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c }} />
      {label}
    </span>
  );
}

/* Inline progress (linear) */
function MiniProgress({ value, max = 100, color, bg }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: 2, background: bg || 'rgba(28,24,20,.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color || 'var(--accent)' }} />
    </div>
  );
}

/* Top app chrome — masthead style */
function Masthead({ active = 'home', dark = false, accent = '#5b8c5a', extras }) {
  const items = [
    { id: 'home',     label: '홈' },
    { id: 'library',  label: '서재' },
    { id: 'ranking',  label: '랭킹' },
    { id: 'register', label: '등록' },
    { id: 'settings', label: '설정' },
  ];
  const ink = dark ? 'var(--cream-100)' : 'var(--ink-900)';
  const sub = dark ? 'var(--cream-300)' : 'var(--ink-500)';
  const rule = dark ? 'rgba(255,236,200,.12)' : 'rgba(28,24,20,.1)';
  return (
    <header style={{
      borderBottom: `1px solid ${rule}`,
      padding: '14px 32px 12px',
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 24,
      background: dark ? 'var(--night-900)' : 'var(--paper-50)',
    }}>
      {/* date / locator on left */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: sub, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        04 · 26 · 2026 — KR EDITION
      </div>
      {/* nameplate */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          fontStyle: 'italic',
          fontWeight: 500,
          color: ink,
          letterSpacing: '-0.01em',
        }}>
          Narou <span style={{ color: accent, fontStyle: 'normal' }}>·</span> Reader
        </div>
        <div style={{ fontFamily: 'var(--font-jp)', fontSize: 9, color: sub, letterSpacing: '0.3em', marginTop: 1 }}>
          なろう リーダー · 나로우 리더
        </div>
      </div>
      {/* nav right */}
      <nav style={{
        display: 'flex', justifyContent: 'flex-end', gap: 18,
        fontFamily: 'var(--font-sans)', fontSize: 12,
      }}>
        {items.map(it => (
          <span key={it.id} style={{
            color: active === it.id ? ink : sub,
            fontWeight: active === it.id ? 600 : 400,
            borderBottom: active === it.id ? `1.5px solid ${accent}` : '1.5px solid transparent',
            paddingBottom: 2,
            cursor: 'pointer',
          }}>{it.label}</span>
        ))}
        {extras}
      </nav>
    </header>
  );
}

/* Section heading with rule */
function Eyebrow({ children, dark }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: dark ? 'var(--cream-300)' : 'var(--ink-500)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ flex: '0 0 16px', height: 1, background: 'currentColor', opacity: 0.4 }} />
      {children}
    </div>
  );
}

/* Sample data — used across many screens */
const NOVELS = [
  { id: 1, jp: '魔女と弓兵', kr: '마녀와 궁병',  ncode: 'n3478er', ep: 94, total: 94, status: 'done',
    author: '夜野ゆうき', updated: '4/25/2026', genre: '판타지', subscribed: true,
    excerpt: '「死ね、もうとうに準備する勇兵、軍令の死命、神技に魔法による楽器の演奏できよう。」',
    excerptKr: '「죽어, 이미 준비하는 용병, 군령의 사명, 신기에 마법에 의한 악기의 연주처럼.」' },
  { id: 2, jp: '万が一、会社員が異世界の最強兵になって転生されたら', kr: '만약, 회사원이 이세계의 제3황자에게 전생했다 [연재판]',
    ncode: 'n8821fz', ep: 14, total: 28, status: 'queued',
    author: '黒木ヒロ', updated: '4/25/2026', genre: '이세계 전생', subscribed: true,
    excerpt: 'もし、会社の異世界の第三皇子に転生したら…', excerptKr: '만약, 회사원이 이세계의 제3황자에게…' },
  { id: 3, jp: '【連載版】「才能のない実力者」と勘違いされた、転生王女と公爵令嬢',
    kr: '[연재판] "더 없는 실력자"라며 바보 취급받았던 전생[왕녀와 공작...',
    ncode: 'n9912dq', ep: 3, total: 47, status: 'done',
    author: '雪村ねむ', updated: '4/24/2026', genre: '여성향 판타지', subscribed: true,
    excerpt: '空魚な妖精のいた天昼の住む人々と王女は…', excerptKr: '공허한 요정이 살았던 백주의 거주민들과 왕녀는…' },
  { id: 4, jp: 'この世界に戻りたい、生活が物足りない',  kr: '이세계에 왔지만, 생활 마법밖에 쓸 수 없습니다',
    ncode: 'n2245kc', ep: 1, total: 12, status: 'queued',
    author: '東野まなみ', updated: '4/16/2026', genre: '슬로우 라이프', subscribed: false,
    excerpt: '異世界に戻った、けど生活魔法しか使えない…', excerptKr: '이세계에 왔지만 생활 마법 밖에…' },
  { id: 5, jp: '薬屋の娘が異世界に呼ばれた件について【350万PV感謝】',
    kr: '약국 영애가 될 미정이었지만, 인적 무대에서 너머갈니다 [350만 PV 감사]',
    ncode: 'n5599wz', ep: 1, total: 1, status: 'failed',
    author: '林田あさひ', updated: '4/14/2026', genre: '코미디·로맨스', subscribed: false,
    excerpt: '薬屋の娘が異世界に呼ばれて…', excerptKr: '약국집 딸이 이세계에 불려가게 된…' },
  { id: 6, jp: '蒼穹の使徒、月光の剣',  kr: '창궁의 사도, 월광의 검',
    ncode: 'n7811bk', ep: 41, total: 88, status: 'done',
    author: '七瀬玲', updated: '4/22/2026', genre: '하이 판타지', subscribed: true,
    excerpt: '蒼き月の下、剣を握る者は…', excerptKr: '푸른 달 아래, 검을 쥔 자는…' },
];

/* Continue-reading data */
const CONTINUE = NOVELS.slice(0, 5).map((n, i) => ({
  ...n,
  episode: [94, 14, 3, 1, 1][i],
  episodeTitle: [
    '#94 — 終局',
    '#14 — 決断',
    '#3 — 03',
    '#1 — 流星雨',
    '#1 — 第1話 「呼ばれた」',
  ][i],
  progress: [88, 42, 15, 70, 95][i],
  date: ['4/25/2026', '4/25/2026', '4/24/2026', '4/16/2026', '4/14/2026'][i],
}));

Object.assign(window, {
  NovelCover, StatusPill, MiniProgress, Masthead, Eyebrow,
  NOVELS, CONTINUE,
});
