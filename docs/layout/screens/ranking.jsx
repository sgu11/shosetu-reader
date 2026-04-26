/* RANKING — discovery — two variations
   A · Magazine top 10 — paper editorial
   B · Charts grid — dark with movement
*/

const RANK = [
  { rank: 1, jp: '蒼穹の使徒', kr: '창궁의 사도, 월광의 검', author: '七瀬玲', genre: '하이 판타지', pts: '12,840', delta: 0, ncode: 'n7811bk' },
  { rank: 2, jp: '魔女と弓兵', kr: '마녀와 궁병', author: '夜野ゆうき', genre: '판타지', pts: '11,222', delta: +3, ncode: 'n3478er' },
  { rank: 3, jp: '転生王女と公爵令嬢', kr: '전생왕녀와 공작영애', author: '雪村ねむ', genre: '여성향', pts: '10,114', delta: -1, ncode: 'n9912dq' },
  { rank: 4, jp: '会社員の異世界転生', kr: '회사원의 이세계 전생', author: '黒木ヒロ', genre: '이세계', pts: '9,640', delta: +1, ncode: 'n8821fz' },
  { rank: 5, jp: '生活魔法しか', kr: '생활 마법밖에 쓸 수 없습니다', author: '東野まなみ', genre: '슬로우라이프', pts: '8,520', delta: -2, ncode: 'n2245kc' },
  { rank: 6, jp: '薬屋の娘', kr: '약국 영애의 모험', author: '林田あさひ', genre: '코미디', pts: '7,910', delta: +5, ncode: 'n5599wz' },
  { rank: 7, jp: '銀の旅人', kr: '은빛의 여행자', author: '雨宮かなで', genre: '하이 판타지', pts: '7,320', delta: 0, ncode: 'n6688aa' },
  { rank: 8, jp: '夜のカフェ', kr: '밤의 카페', author: '森野理沙', genre: '일상', pts: '6,840', delta: -1, ncode: 'n4421pp' },
];

function RankingMag() {
  return (
    <div className="frame-paper paper-grain" style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <Masthead active="ranking" />

      <section style={{ padding: '40px 56px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow>Discover · 발견</Eyebrow>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 64, margin: '8px 0 0', letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
              <span style={{ fontStyle: 'italic' }}>Top of</span> Syosetu
            </h1>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-600)', margin: '6px 0 0' }}>
              나로우 종합 랭킹 — 매일 갱신, 한국어 제목 자동 번역.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--paper-100)', borderRadius: 999, border: '1px solid rgba(28,24,20,.08)' }}>
            {['일간', '주간', '월간', '분기'].map((p, i) => (
              <span key={p} style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 999,
                background: i === 1 ? 'var(--ink-900)' : 'transparent',
                color: i === 1 ? 'var(--paper-50)' : 'var(--ink-700)',
                fontWeight: i === 1 ? 600 : 400, cursor: 'pointer',
              }}>{p}</span>
            ))}
          </div>
        </div>
      </section>

      <div style={{ padding: '0 56px 16px' }}>
        {/* hero #1 */}
        <article style={{
          background: 'var(--paper-100)', borderRadius: 'var(--r-md)',
          padding: 22, display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 20, alignItems: 'center',
          border: '1px solid rgba(28,24,20,.08)',
        }}>
          <NovelCover jp={RANK[0].jp} kr={RANK[0].kr} w={120} h={170} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 64, fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)', lineHeight: 1 }}>№1</span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)', letterSpacing: '.16em' }}>{RANK[0].ncode} · {RANK[0].genre}</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 32, margin: '4px 0 2px', color: 'var(--ink-900)', lineHeight: 1.1 }}>{RANK[0].kr}</h2>
                <div style={{ fontFamily: 'var(--font-jp)', fontSize: 14, color: 'var(--ink-600)' }}>{RANK[0].jp} — {RANK[0].author}</div>
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5, color: 'var(--ink-700)', margin: '12px 0 0', lineHeight: 1.55, maxWidth: 560 }}>
              푸른 달 아래, 검을 쥔 자는 무엇을 지키는가. 8개월간 종합 랭킹 1위를 지키고 있는 작품.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>{RANK[0].pts} pt</span>
            <button style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, padding: '8px 14px', borderRadius: 999,
              background: 'var(--ink-900)', color: 'var(--paper-50)', border: 'none', cursor: 'pointer',
            }}>+ 서재에 추가</button>
            <button style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, padding: '8px 14px', borderRadius: 999,
              background: 'transparent', color: 'var(--ink-700)', border: '1px solid rgba(28,24,20,.18)', cursor: 'pointer',
            }}>미리보기</button>
          </div>
        </article>
      </div>

      <div style={{ padding: '0 56px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {RANK.slice(1).map(r => (
          <div key={r.rank} style={{
            display: 'grid', gridTemplateColumns: '40px 50px 1fr 120px 80px 80px 110px',
            gap: 16, alignItems: 'center',
            padding: '14px 0', borderBottom: '1px solid rgba(28,24,20,.08)',
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-700)' }}>{r.rank}</span>
            <NovelCover jp={r.jp} kr={r.kr} w={38} h={54} />
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500, color: 'var(--ink-900)', lineHeight: 1.2 }}>{r.kr}</div>
              <div style={{ fontFamily: 'var(--font-jp)', fontSize: 11.5, color: 'var(--ink-500)' }}>{r.jp} · {r.author}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ink-700)' }}>{r.genre}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-700)' }}>{r.pts} pt</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: r.delta > 0 ? 'var(--accent)' : r.delta < 0 ? 'var(--status-failed)' : 'var(--ink-400)',
            }}>{r.delta > 0 ? `▲ ${r.delta}` : r.delta < 0 ? `▼ ${Math.abs(r.delta)}` : '— 0'}</span>
            <button style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 999,
              background: 'transparent', color: 'var(--ink-800)', border: '1px solid rgba(28,24,20,.18)', cursor: 'pointer',
            }}>+ 추가</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── B · CHARTS GRID ──────────────────── */

function RankingCharts() {
  return (
    <div className="frame-night night-grain" style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', color: 'var(--cream-100)' }}>
      <Masthead active="ranking" dark accent="#d4a373" />

      <section style={{ padding: '32px 56px 18px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow dark>Daily Charts · 4월 26일</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: 56, margin: '8px 0 0', color: 'var(--cream-100)' }}>The Climb.</h1>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['종합', '판타지', '연애', '이세계'].map((g, i) => (
            <span key={g} style={{
              fontSize: 11.5, padding: '6px 12px', borderRadius: 999,
              background: i === 0 ? 'rgba(212,163,115,.15)' : 'transparent',
              color: i === 0 ? '#d4a373' : 'var(--cream-300)',
              border: '1px solid ' + (i === 0 ? 'rgba(212,163,115,.3)' : 'rgba(255,236,200,.1)'),
              cursor: 'pointer',
            }}>{g}</span>
          ))}
        </div>
      </section>

      <div style={{ padding: '0 56px', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {RANK.slice(0, 8).map(r => {
            const movement = Array.from({ length: 14 }, (_, i) => 30 + Math.sin(i + r.rank) * 8 + (i / 14) * (r.delta > 0 ? -10 : r.delta < 0 ? 10 : 0));
            return (
              <article key={r.rank} style={{
                background: 'rgba(255,236,200,.04)',
                border: '1px solid rgba(255,236,200,.08)',
                borderRadius: 'var(--r-md)',
                padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: -6, right: 8,
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  fontSize: 80, color: 'rgba(212,163,115,.12)', fontWeight: 300, lineHeight: 1,
                }}>{r.rank}</div>
                <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  <NovelCover jp={r.jp} kr={r.kr} w={48} h={68} variant="night" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--cream-300)' }}>{r.ncode}</div>
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 13.5, fontWeight: 500, color: 'var(--cream-100)', margin: '2px 0', lineHeight: 1.2,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.kr}</h4>
                    <div style={{ fontFamily: 'var(--font-jp)', fontSize: 10, color: 'var(--cream-300)' }}>{r.author}</div>
                  </div>
                </div>
                {/* movement spark */}
                <svg viewBox="0 0 100 30" style={{ width: '100%', height: 26 }} preserveAspectRatio="none">
                  <polyline
                    points={movement.map((v, i) => `${(i / 13) * 100},${v}`).join(' ')}
                    fill="none" stroke={r.delta >= 0 ? '#d4a373' : '#b14a3a'} strokeWidth="1.4"
                  />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)' }}>
                  <span style={{ color: r.delta > 0 ? '#a8c98e' : r.delta < 0 ? '#e09b8b' : 'var(--cream-300)' }}>
                    {r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${Math.abs(r.delta)}` : '— 0'}
                  </span>
                  <span>{r.pts} pt</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RankingMag, RankingCharts });
