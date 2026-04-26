/* HOME — two variations
   A · "Editorial Daily" — paper, masthead, magazine-style hero
   B · "Cozy Night Stand" — dark, warm, intimate
*/

function HomeEditorial() {
  return (
    <div className="frame-paper paper-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
    }}>
      <Masthead active="home" />

      {/* hero */}
      <section style={{ padding: '46px 56px 28px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 56, alignItems: 'end' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.22em', color: 'var(--ink-500)', textTransform: 'uppercase' }}>
            Vol. IV — Issue 26 · 2026年 4月号
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 400,
            fontSize: 84, lineHeight: 0.95, margin: '14px 0 18px',
            letterSpacing: '-0.025em', color: 'var(--ink-900)',
          }}>
            <span style={{ fontStyle: 'italic' }}>Tonight's</span> reading,<br/>
            <span style={{ color: 'var(--accent)' }}>quietly</span> translated.
          </h1>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.55, color: 'var(--ink-600)', maxWidth: 520, margin: 0 }}>
            나로우 일본 웹소설을 위한 편안한 읽기 환경. 이어읽기, 한국어 번역, 개인 서재, 작품 발견까지 — 한 곳에서.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              padding: '10px 18px', borderRadius: 999,
              background: 'var(--ink-900)', color: 'var(--paper-50)',
              border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              이어서 읽기
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6 }}>#94 마녀와 궁병</span>
            </button>
            <button style={{
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              padding: '10px 18px', borderRadius: 999,
              background: 'transparent', color: 'var(--ink-800)',
              border: '1px solid rgba(28,24,20,.18)', cursor: 'pointer',
            }}>소설 추가 +</button>
          </div>
        </div>

        {/* stats card */}
        <div style={{
          background: 'var(--paper-100)',
          border: '1px solid rgba(28,24,20,.08)',
          borderRadius: 'var(--r-md)',
          padding: 22,
        }}>
          <Eyebrow>This week's reading</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 14 }}>
            {[
              { v: '7.3h', l: '읽은 시간', sub: '+1.2h vs last' },
              { v: '24', l: '에피소드', sub: '6 days streak' },
              { v: '12', l: '신규 번역', sub: '$0.34 cost' },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 36, lineHeight: 1, color: 'var(--ink-900)', fontWeight: 400 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-700)', marginTop: 6 }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-500)', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
          {/* sparkline */}
          <svg viewBox="0 0 200 36" style={{ width: '100%', height: 36, marginTop: 16 }}>
            <polyline points="0,28 22,22 44,26 66,18 88,20 110,12 132,16 154,8 176,14 200,6"
              fill="none" stroke="var(--accent)" strokeWidth="1.4" />
            <polyline points="0,28 22,22 44,26 66,18 88,20 110,12 132,16 154,8 176,14 200,6"
              fill="none" stroke="var(--accent)" strokeOpacity="0.15" strokeWidth="6" />
          </svg>
        </div>
      </section>

      {/* divider */}
      <div style={{ borderTop: '1px solid rgba(28,24,20,.1)', margin: '0 56px' }} />

      {/* continue reading — editorial list */}
      <section style={{ padding: '24px 56px 0', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 28, margin: 0, color: 'var(--ink-900)' }}>
            이어서 읽기
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)', letterSpacing: '.1em' }}>5 books in progress</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 22 }}>
          {/* feature card */}
          <FeatureCard novel={CONTINUE[0]} />
          {/* secondary stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SecondaryCard novel={CONTINUE[1]} />
            <SecondaryCard novel={CONTINUE[2]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SecondaryCard novel={CONTINUE[3]} />
            <SecondaryCard novel={CONTINUE[4]} />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ novel }) {
  return (
    <article style={{
      background: 'var(--paper-100)',
      border: '1px solid rgba(28,24,20,.08)',
      borderRadius: 'var(--r-md)',
      padding: 18,
      display: 'flex', gap: 16,
    }}>
      <NovelCover jp={novel.jp} kr={novel.kr} w={104} h={148} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)', letterSpacing: '.1em' }}>
          NOW READING · {novel.ncode}
        </div>
        <h3 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 500,
          fontSize: 22, lineHeight: 1.15, margin: '6px 0 4px',
          color: 'var(--ink-900)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{novel.kr}</h3>
        <div style={{ fontFamily: 'var(--font-jp)', fontSize: 12, color: 'var(--ink-500)' }}>{novel.jp}</div>
        <div style={{ flex: 1 }} />
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-700)', marginBottom: 6 }}>
            <span>{novel.episodeTitle}</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{novel.progress}%</span>
          </div>
          <MiniProgress value={novel.progress} color="var(--accent)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>{novel.date}</span>
            <button style={{
              fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
              padding: '6px 12px', borderRadius: 999,
              background: 'var(--ink-900)', color: 'var(--paper-50)', border: 'none', cursor: 'pointer',
            }}>계속 읽기 →</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function SecondaryCard({ novel }) {
  return (
    <article style={{
      background: 'var(--paper-100)',
      border: '1px solid rgba(28,24,20,.08)',
      borderRadius: 'var(--r-md)',
      padding: 14,
      display: 'flex', gap: 12,
    }}>
      <NovelCover jp={novel.jp} kr={novel.kr} w={56} h={80} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)', letterSpacing: '.1em' }}>{novel.ncode}</div>
        <h4 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 500,
          fontSize: 14, lineHeight: 1.25, margin: '3px 0 4px',
          color: 'var(--ink-900)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{novel.kr}</h4>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-500)' }}>{novel.episodeTitle}</div>
        <div style={{ marginTop: 8 }}>
          <MiniProgress value={novel.progress} color="var(--accent)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 9.5, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>
            <span>{novel.progress}%</span>
            <span>{novel.date}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ─────────────── B · COZY NIGHT STAND ──────────────────────── */

function HomeNight() {
  return (
    <div className="frame-night night-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      background: 'radial-gradient(120% 80% at 50% -10%, #1f1812 0%, var(--night-900) 60%)',
    }}>
      <Masthead active="home" dark accent="#d4a373" />

      <div style={{ padding: '40px 56px 0', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40 }}>
        {/* greeting */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)', letterSpacing: '.18em' }}>
            오후 11 : 14 — 月のひかり
          </div>
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 300,
            fontSize: 56, lineHeight: 1.05, margin: '12px 0 8px',
            letterSpacing: '-0.02em', color: 'var(--cream-100)',
          }}>
            <span style={{ fontStyle: 'italic' }}>안녕,</span> 채아.<br/>
            <span style={{ color: '#d4a373' }}>한 챕터</span>만 읽고 잘까요?
          </h1>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--cream-300)', maxWidth: 480, margin: 0 }}>
            마녀와 궁병 #94의 마지막 부분을 읽다 두셨어요. 약 4분이면 끝나요.
          </p>
        </div>

        {/* stats — vertical strip */}
        <div style={{
          background: 'rgba(255,236,200,.04)',
          border: '1px solid rgba(255,236,200,.08)',
          borderRadius: 'var(--r-md)',
          padding: 16,
        }}>
          <Eyebrow dark>이번 주 읽기 기록</Eyebrow>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { v: '7시간 18분', l: '독서 시간', d: 0.74 },
              { v: '24 에피소드', l: '완독', d: 0.5 },
              { v: '6일 연속', l: '스트릭 🔥', d: 0.85 },
            ].map(s => (
              <div key={s.l}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cream-100)', marginBottom: 4 }}>
                  <span>{s.l}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cream-300)' }}>{s.v}</span>
                </div>
                <MiniProgress value={s.d * 100} color="#d4a373" bg="rgba(255,236,200,.08)" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* big continue card */}
      <section style={{ padding: '32px 56px 0' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(212,163,115,.15), transparent 60%), rgba(255,236,200,.03)',
          border: '1px solid rgba(255,236,200,.1)',
          borderRadius: 'var(--r-lg)',
          padding: 28,
          display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: 24, alignItems: 'center',
        }}>
          <NovelCover jp={CONTINUE[0].jp} kr={CONTINUE[0].kr} w={120} h={170} variant="night" />
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)', letterSpacing: '.16em' }}>
              CONTINUE · {CONTINUE[0].ncode}
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 30, margin: '6px 0 8px', color: 'var(--cream-100)' }}>
              {CONTINUE[0].kr}
            </h2>
            <div style={{ fontFamily: 'var(--font-jp)', fontSize: 12, color: 'var(--cream-300)' }}>{CONTINUE[0].jp}</div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--cream-200)', margin: '12px 0 0', lineHeight: 1.55, maxWidth: 480 }}>
              「{CONTINUE[0].excerptKr}」
            </p>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 64, fontWeight: 300, color: 'var(--cream-100)', lineHeight: 1 }}>
              {CONTINUE[0].progress}<span style={{ fontSize: 24, color: 'var(--cream-300)' }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--cream-300)', marginBottom: 12 }}>{CONTINUE[0].episodeTitle}</div>
            <button style={{
              width: '100%',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              padding: '12px 16px', borderRadius: 'var(--r-md)',
              background: '#d4a373', color: 'var(--night-900)', border: 'none', cursor: 'pointer',
            }}>이어서 읽기 →</button>
          </div>
        </div>
      </section>

      {/* horizontal carousel */}
      <section style={{ padding: '28px 56px 0' }}>
        <Eyebrow dark>다른 책장</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 12 }}>
          {CONTINUE.slice(1, 5).map(n => (
            <article key={n.id} style={{
              background: 'rgba(255,236,200,.04)',
              border: '1px solid rgba(255,236,200,.08)',
              borderRadius: 'var(--r-md)',
              padding: 14,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <NovelCover jp={n.jp} kr={n.kr} w={48} h={68} variant="night" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.25, color: 'var(--cream-100)', margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.kr}</h4>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cream-300)', marginTop: 4 }}>{n.episodeTitle}</div>
                </div>
              </div>
              <MiniProgress value={n.progress} color="#d4a373" bg="rgba(255,236,200,.08)" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--cream-300)' }}>
                <span>{n.progress}%</span>
                <span>{n.date}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { HomeEditorial, HomeNight });
