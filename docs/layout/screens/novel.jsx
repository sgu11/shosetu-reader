/* NOVEL DETAIL — episode list — two variations */

const EPISODES = Array.from({ length: 12 }, (_, i) => ({
  no: 94 - i,
  jp: ['終局','序章の終わり','深淵の声','銀の使者','薄明の宴','約束の地','空白の月','灰の塔','風の舟','森の門','静謐','残響'][i],
  kr: ['종국','서장의 끝','심연의 목소리','은빛 사자','황혼의 연회','약속의 땅','공백의 달','잿빛의 탑','바람의 배','숲의 문','정적','잔향'][i],
  date: `4/${25 - i}/2026`,
  status: i < 8 ? 'done' : i < 10 ? 'queued' : 'failed',
  read: i === 0 ? 'reading' : i < 4 ? 'done' : 'unread',
  chars: 4210 - i * 130,
}));

function NovelDetail() {
  const novel = NOVELS[0];
  return (
    <div className="frame-paper paper-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
    }}>
      <Masthead active="library" />

      {/* hero */}
      <section style={{ padding: '40px 56px 28px', display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 32, alignItems: 'flex-end' }}>
        <NovelCover jp={novel.jp} kr={novel.kr} w={180} h={252} />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-500)' }}>
            {novel.ncode} · {novel.genre} · 구독 중
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 56, margin: '10px 0 6px', letterSpacing: '-0.02em', lineHeight: 1.05, color: 'var(--ink-900)' }}>
            {novel.kr}
          </h1>
          <div style={{ fontFamily: 'var(--font-jp)', fontSize: 18, color: 'var(--ink-600)', marginBottom: 14 }}>
            {novel.jp} <span style={{ color: 'var(--ink-400)' }}>—</span> {novel.author}
          </div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--ink-700)', maxWidth: 560, lineHeight: 1.6, margin: 0 }}>
            북부 설원의 마녀와 그녀를 쫓는 한 궁병의 일대기. 8년에 걸쳐 전 94화로 완결된 작품. 잔잔한 문체와 점층적 비극이 인상적이다.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
          <button style={{
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
            padding: '10px 16px', borderRadius: 999,
            background: 'var(--ink-900)', color: 'var(--paper-50)', border: 'none', cursor: 'pointer',
          }}>이어서 읽기 →</button>
          <button style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, padding: '8px 16px', borderRadius: 999,
            background: 'transparent', color: 'var(--ink-800)', border: '1px solid rgba(28,24,20,.18)', cursor: 'pointer',
          }}>일괄 번역 +6</button>
          <button style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, padding: '8px 16px', borderRadius: 999,
            background: 'transparent', color: 'var(--ink-800)', border: '1px solid rgba(28,24,20,.18)', cursor: 'pointer',
          }}>용어집 편집</button>
        </div>
      </section>

      {/* meta strip */}
      <div style={{ padding: '0 56px 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0, borderTop: '1px solid rgba(28,24,20,.1)', borderBottom: '1px solid rgba(28,24,20,.1)' }}>
          {[
            { l: '에피소드', v: '94', s: '완결' },
            { l: '읽음', v: '88', s: '93.6%' },
            { l: '번역됨', v: '92', s: '2 대기' },
            { l: '글자 수', v: '385K', s: '약 17시간' },
            { l: '비용 합계', v: '$3.42', s: '평균 $0.04/화' },
          ].map((m, i) => (
            <div key={m.l} style={{ padding: '14px 18px', borderLeft: i ? '1px solid rgba(28,24,20,.08)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-500)', letterSpacing: '.1em' }}>{m.l}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink-900)', fontWeight: 400, marginTop: 2 }}>{m.v}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-500)' }}>{m.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* episodes table */}
      <div style={{ padding: '0 56px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 24, margin: 0, color: 'var(--ink-900)' }}>
            에피소드 목록
          </h2>
          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
            {['전체 94', '읽지 않음 6', '대기 2', '실패 0'].map((f, i) => (
              <span key={f} style={{
                padding: '5px 10px', borderRadius: 999,
                background: i === 0 ? 'var(--ink-900)' : 'transparent',
                color: i === 0 ? 'var(--paper-50)' : 'var(--ink-700)',
                border: i === 0 ? 'none' : '1px solid rgba(28,24,20,.14)', cursor: 'pointer',
              }}>{f}</span>
            ))}
          </div>
        </div>

        {EPISODES.map(ep => (
          <div key={ep.no} style={{
            display: 'grid', gridTemplateColumns: '54px 1fr 130px 110px 90px',
            gap: 16, alignItems: 'center',
            padding: '12px 0', borderBottom: '1px solid rgba(28,24,20,.08)',
            background: ep.read === 'reading' ? 'rgba(91,140,90,.06)' : 'transparent',
            paddingLeft: ep.read === 'reading' ? 14 : 0,
            borderLeft: ep.read === 'reading' ? '2px solid var(--accent)' : '2px solid transparent',
            marginLeft: -14, paddingRight: 14,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>#{ep.no}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: 'var(--ink-900)' }}>
                {ep.kr} {ep.read === 'reading' && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>읽는 중 36%</span>}
              </div>
              <div style={{ fontFamily: 'var(--font-jp)', fontSize: 12, color: 'var(--ink-500)' }}>{ep.jp}</div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>{ep.chars.toLocaleString()}字</span>
            <StatusPill kind={ep.status} label={ep.status === 'done' ? '번역됨' : ep.status === 'queued' ? '대기' : '실패'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-500)', textAlign: 'right' }}>{ep.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── B · NOVEL DETAIL — DARK COMPACT ──────────────────── */

function NovelDetailDark() {
  const novel = NOVELS[2];
  return (
    <div className="frame-night night-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)', color: 'var(--cream-100)',
    }}>
      <Masthead active="library" dark accent="#d4a373" />

      <section style={{
        padding: '36px 56px 24px',
        background: 'linear-gradient(135deg, rgba(212,163,115,.1), transparent 60%)',
        borderBottom: '1px solid rgba(255,236,200,.08)',
        display: 'grid', gridTemplateColumns: '140px 1fr 200px', gap: 28, alignItems: 'center',
      }}>
        <NovelCover jp={novel.jp} kr={novel.kr} w={140} h={196} variant="night" />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)', letterSpacing: '.16em' }}>
            {novel.ncode} · {novel.genre}
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 38, margin: '8px 0 4px', color: 'var(--cream-100)', lineHeight: 1.1 }}>
            {novel.kr}
          </h1>
          <div style={{ fontFamily: 'var(--font-jp)', fontSize: 13, color: 'var(--cream-300)' }}>{novel.jp}</div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 11, color: 'var(--cream-200)', fontFamily: 'var(--font-mono)' }}>
            <span>3 / 47 화</span>
            <span style={{ color: 'var(--cream-300)' }}>·</span>
            <span>구독중</span>
            <span style={{ color: 'var(--cream-300)' }}>·</span>
            <span style={{ color: '#d4a373' }}>● 새 에피소드 6</span>
          </div>
        </div>
        <button style={{
          fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
          padding: '12px 18px', borderRadius: 'var(--r-md)',
          background: '#d4a373', color: 'var(--night-900)', border: 'none', cursor: 'pointer',
        }}>#3부터 읽기 →</button>
      </section>

      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 280px' }}>
        <div style={{ overflowY: 'auto', padding: '20px 32px' }} className="no-scrollbar">
          {EPISODES.slice(0, 10).map(ep => (
            <div key={ep.no} style={{
              padding: '12px 14px', borderRadius: 'var(--r-sm)',
              background: ep.read === 'reading' ? 'rgba(212,163,115,.08)' : 'transparent',
              borderLeft: ep.read === 'reading' ? '2px solid #d4a373' : '2px solid transparent',
              display: 'grid', gridTemplateColumns: '50px 1fr auto auto', gap: 14, alignItems: 'center',
              marginBottom: 2,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cream-300)' }}>#{ep.no}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--cream-100)' }}>{ep.kr}</div>
                <div style={{ fontFamily: 'var(--font-jp)', fontSize: 11, color: 'var(--cream-300)' }}>{ep.jp}</div>
              </div>
              <StatusPill kind={ep.status} dark label={ep.status === 'done' ? '✓' : ep.status === 'queued' ? '대기' : '실패'} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)' }}>{ep.date}</span>
            </div>
          ))}
        </div>
        <aside style={{ borderLeft: '1px solid rgba(255,236,200,.08)', padding: 22, background: 'rgba(20,17,13,.5)' }}>
          <Eyebrow dark>번역 인벤토리</Eyebrow>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Sonnet 4.5', count: 38, cost: '$2.14', pct: 0.81 },
              { name: 'Haiku 4.5',  count: 6,  cost: '$0.32', pct: 0.13 },
              { name: 'GPT-4o',     count: 3,  cost: '$0.96', pct: 0.06 },
            ].map(m => (
              <div key={m.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ color: 'var(--cream-100)' }}>{m.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cream-300)' }}>{m.count} · {m.cost}</span>
                </div>
                <MiniProgress value={m.pct * 100} color="#d4a373" bg="rgba(255,236,200,.06)" />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <Eyebrow dark>품질 경고</Eyebrow>
            <div style={{ marginTop: 10, padding: 12, background: 'rgba(177,74,58,.12)', border: '1px solid rgba(177,74,58,.3)', borderRadius: 'var(--r-sm)', fontSize: 11, color: 'var(--cream-200)', lineHeight: 1.5 }}>
              <div style={{ color: '#e09b8b', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.1em', marginBottom: 4 }}>EP #87 · LENGTH MISMATCH</div>
              번역본이 원문보다 32% 짧습니다. 재번역을 권장합니다.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { NovelDetail, NovelDetailDark });
