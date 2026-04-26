/* READER — JA/KR bilingual — two variations
   A · "Parallel paper" — side-by-side JA / KR, paper, glossary drawer
   B · "Single column with toggle" — one column, KR/JA toggle, focus mode
*/

const READER_JP = [
  '日が暮れかける准備する有兵、奥行きの牢獄、神技に魔法による楽器の演奏できよう。',
  '絶望と圧倒する間がいる影を見て、何でも応じきれない鬼怒さでだった。',
  'いがおまえもどうかんって、沈め寝坊強かれ目とほぼ手が落ちるな様子。',
  '「君が呑むなら、本気を覚悟して、まやーまかいる、という気配さわ」',
  '魔師という術が緒の薄い蘭をたどり、その奇跡を察っ口こそが宙きらしと延べいる。',
  'ゆえど我れの語りで似ているたわらの間に、雪原の住む人々と王女は…',
];
const READER_KR = [
  '해가 지기 시작하는 준비하는 유병, 깊이의 뇌옥, 신기에 마법에 의한 악기의 연주처럼.',
  '절망과 압도하는 사이에 있는 그림자를 보고, 무엇에도 응할 수 없는 노여움이었다.',
  '이가 그대도 어떻게 든, 잠겨 잠 못 든 강한 자 같이 거의 손이 떨어지는 모습.',
  '「그대가 마시려 든다면, 진심을 각오하고, 마야— 마카이루, 라는 기운이」',
  '마사라는 술이 흐름의 옅은 난을 따르며, 그 기적을 살핀 입이야말로 하늘 같다고 말하고 있다.',
  '그러나 우리의 이야기 속 비슷한 들판 사이에, 설원에 사는 사람들과 왕녀는…',
];

function ReaderParallel() {
  return (
    <div className="frame-paper paper-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* slim reader chrome */}
      <header style={{
        padding: '12px 28px',
        borderBottom: '1px solid rgba(28,24,20,.1)',
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 24,
        background: 'var(--paper-50)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-700)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: 0 }}>
            ← <span>마녀와 궁병</span>
          </button>
          <span style={{ color: 'var(--ink-300)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>#94 — 終局</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'var(--paper-100)', borderRadius: 999, padding: 2, border: '1px solid rgba(28,24,20,.08)' }}>
            {['JA', 'KR', '병렬'].map((t, i) => (
              <span key={t} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '5px 12px', borderRadius: 999,
                background: i === 2 ? 'var(--ink-900)' : 'transparent',
                color: i === 2 ? 'var(--paper-50)' : 'var(--ink-700)',
                fontWeight: i === 2 ? 600 : 400, cursor: 'pointer',
              }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-500)' }}>
          <span>약 11분 · 4,210字</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-700)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
            Claude · Sonnet 4.5
          </span>
          <span style={{ color: 'var(--ink-700)', cursor: 'pointer' }}>Aa</span>
          <span style={{ color: 'var(--ink-700)', cursor: 'pointer' }}>☾</span>
        </div>
      </header>

      {/* progress sliver */}
      <div style={{ height: 2, background: 'rgba(28,24,20,.06)' }}>
        <div style={{ width: '36%', height: '100%', background: 'var(--accent)' }} />
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden' }}>
        {/* main content */}
        <main style={{ overflow: 'hidden', padding: '32px 56px', display: 'flex', justifyContent: 'center' }}>
          <article style={{ maxWidth: 880, width: '100%' }}>
            {/* chapter heading */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-500)' }}>
                CHAPTER NINETY-FOUR
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 36, margin: '8px 0 6px', color: 'var(--ink-900)' }}>
                終局
              </h1>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-600)' }}>종국 · The Ending</div>
              <div style={{ width: 30, height: 1, background: 'var(--ink-300)', margin: '14px auto 0' }} />
            </div>

            {/* parallel paragraphs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
              {/* JA col */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.18em', color: 'var(--ink-500)', marginBottom: 10 }}>
                  日本語 · ORIGINAL
                </div>
                {READER_JP.map((p, i) => (
                  <p key={i} style={{
                    fontFamily: 'var(--font-jp)', fontSize: 14.5, lineHeight: 1.95,
                    color: i === 1 ? 'var(--ink-900)' : 'var(--ink-700)', marginBottom: 14, marginTop: 0,
                    background: i === 1 ? 'rgba(91,140,90,.08)' : 'transparent',
                    padding: i === 1 ? '4px 8px' : '0',
                    borderLeft: i === 1 ? '2px solid var(--accent)' : 'none',
                    marginLeft: i === 1 ? -10 : 0,
                  }}>{p}</p>
                ))}
              </div>
              {/* KR col */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.18em', color: 'var(--ink-500)', marginBottom: 10 }}>
                  한국어 · TRANSLATED
                </div>
                {READER_KR.map((p, i) => (
                  <p key={i} style={{
                    fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.85,
                    color: i === 1 ? 'var(--ink-900)' : 'var(--ink-700)', marginBottom: 14, marginTop: 0,
                    background: i === 1 ? 'rgba(91,140,90,.08)' : 'transparent',
                    padding: i === 1 ? '4px 8px' : '0',
                    borderLeft: i === 1 ? '2px solid var(--accent)' : 'none',
                    marginLeft: i === 1 ? -10 : 0,
                  }}>{p}</p>
                ))}
              </div>
            </div>

            {/* nav */}
            <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, paddingTop: 20, borderTop: '1px solid rgba(28,24,20,.1)' }}>
              <button style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-700)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                ← #93 序章の終わり
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>94 / 94</span>
              <button style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-300)', background: 'transparent', border: 'none' }}>
                완결 ✓
              </button>
            </nav>
          </article>
        </main>

        {/* glossary drawer */}
        <aside style={{
          borderLeft: '1px solid rgba(28,24,20,.1)',
          padding: 22, overflowY: 'auto', background: 'var(--paper-100)',
        }} className="no-scrollbar">
          <Eyebrow>Glossary · 용어집</Eyebrow>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { jp: '魔師', kr: '마사', tag: '직업', note: '마법을 쓰는 자. 본 작품 고유어.' },
              { jp: '雪原', kr: '설원', tag: '지명', note: '북부의 만년설 지대.' },
              { jp: '神技', kr: '신기', tag: '기술', note: '신에게 받은 능력.' },
              { jp: '王女', kr: '왕녀', tag: '인물', note: 'Hilaria — 제3왕녀.' },
            ].map(g => (
              <div key={g.jp} style={{
                paddingBottom: 12, borderBottom: '1px dashed rgba(28,24,20,.12)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-jp)', fontSize: 16, color: 'var(--ink-900)', fontWeight: 600 }}>{g.jp}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--ink-700)', fontStyle: 'italic' }}>{g.kr}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)', padding: '2px 6px', border: '1px solid rgba(28,24,20,.15)', borderRadius: 3 }}>{g.tag}</span>
                </div>
                <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11.5, color: 'var(--ink-600)', margin: '4px 0 0', lineHeight: 1.5 }}>{g.note}</p>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 'var(--r-md)',
            background: 'var(--paper-200)', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-700)',
            lineHeight: 1.5,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.16em', color: 'var(--ink-500)', marginBottom: 6 }}>STYLE GUIDE</div>
            존댓말 ⇋ 반말 혼용. 인물 호칭은 '님' 통일.
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────── B · SINGLE COLUMN W/ FOCUS ──────────────────── */

function ReaderFocus() {
  return (
    <div className="frame-night night-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)', color: 'var(--cream-100)',
      background: 'radial-gradient(120% 80% at 50% 0%, #1a1410 0%, var(--night-900) 70%)',
    }}>
      {/* minimal floating bar */}
      <header style={{
        padding: '12px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,236,200,.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--cream-300)', cursor: 'pointer', fontSize: 12 }}>← 마녀와 궁병</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--cream-300)' }}>#94 / 94 · 終局</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)', display: 'flex', gap: 16 }}>
          <span>4,210字 · 11분</span>
          <span style={{ color: '#d4a373', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#d4a373' }} /> Sonnet 4.5
          </span>
        </div>
      </header>

      {/* progress arc top */}
      <div style={{ height: 1.5, background: 'rgba(255,236,200,.08)' }}>
        <div style={{ width: '36%', height: '100%', background: '#d4a373' }} />
      </div>

      {/* reading */}
      <main style={{ flex: 1, overflow: 'hidden', padding: '40px 56px', position: 'relative' }}>
        <article style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.22em', color: 'var(--cream-300)' }}>EPISODE 94 OF 94 — 終局</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: 44, margin: '10px 0 6px', color: 'var(--cream-100)' }}>
              종국
            </h1>
            <div style={{ width: 24, height: 1, background: 'var(--cream-300)', margin: '14px auto 0' }} />
          </div>

          {READER_KR.map((p, i) => (
            <p key={i} style={{
              fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.85,
              color: 'var(--cream-100)', marginBottom: 16, marginTop: 0,
              opacity: i < 4 ? 1 : 0.55, /* fade unread */
            }}>{p}</p>
          ))}
          {/* hover inline JA preview hint */}
          <div style={{
            marginTop: 22, padding: '14px 16px', borderRadius: 'var(--r-md)',
            background: 'rgba(255,236,200,.04)', border: '1px solid rgba(255,236,200,.08)',
            fontFamily: 'var(--font-jp)', fontSize: 13, color: 'var(--cream-200)', lineHeight: 1.8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.16em', color: 'var(--cream-300)', marginBottom: 6 }}>
              JA ORIGINAL · ⌥ 호버
            </div>
            {READER_JP[1]}
          </div>
        </article>
      </main>

      {/* floating reader controls */}
      <div style={{
        position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'rgba(20,17,13,.7)', backdropFilter: 'blur(8px)',
        padding: 8, borderRadius: 999,
        border: '1px solid rgba(255,236,200,.1)',
      }}>
        {[
          { l: 'Aa', label: '폰트' },
          { l: '☾', label: '테마' },
          { l: '⇄', label: '병렬' },
          { l: '◧', label: '용어' },
          { l: '✎', label: '메모' },
        ].map(b => (
          <button key={b.label} title={b.label} style={{
            width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent',
            color: 'var(--cream-200)', cursor: 'pointer', fontSize: 13,
          }}>{b.l}</button>
        ))}
      </div>

      {/* bottom mini bar — pacing + nav */}
      <div style={{
        padding: '14px 28px', borderTop: '1px solid rgba(255,236,200,.08)',
        display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', gap: 20,
      }}>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--cream-300)', textAlign: 'left', cursor: 'pointer', fontSize: 12 }}>
          ← 이전 화 #93
        </button>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cream-300)', marginBottom: 5 }}>
            <span>36% · 4분 남음</span>
            <span>현재 페이스 280 字/분</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,236,200,.08)', borderRadius: 4, position: 'relative' }}>
            <div style={{ width: '36%', height: '100%', background: '#d4a373', borderRadius: 4 }} />
            {/* tick marks for paragraphs */}
            {[12, 24, 38, 52, 68, 82].map(t => (
              <span key={t} style={{ position: 'absolute', left: `${t}%`, top: -2, width: 1, height: 8, background: 'rgba(255,236,200,.2)' }} />
            ))}
          </div>
        </div>
        <button style={{ background: 'transparent', border: 'none', color: 'var(--cream-300)', textAlign: 'right', cursor: 'pointer', fontSize: 12 }}>
          완결 ✓
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ReaderParallel, ReaderFocus });
