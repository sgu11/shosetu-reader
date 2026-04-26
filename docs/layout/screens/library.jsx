/* LIBRARY / 서재 — two variations
   A · "Card grid" — paper, generated covers, shelf metaphor
   B · "Index ledger" — typographic list, dense + sortable
*/

function LibraryShelf() {
  return (
    <div className="frame-paper paper-grain" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
    }}>
      <Masthead active="library" />

      {/* page header */}
      <div style={{ padding: '36px 56px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <Eyebrow>나의 서재</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 56, margin: '8px 0 6px', letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
            서재 <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>Bibliothèque</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--ink-600)', margin: 0 }}>
            구독 중인 작품 18편 · 미열람 신규 에피소드 7편
          </p>
        </div>
        {/* filters */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['전체 18', '읽는 중 5', '신규 7', '완독 4', '대기 2'].map((f, i) => (
            <span key={f} style={{
              fontFamily: 'var(--font-sans)', fontSize: 11.5,
              padding: '7px 12px', borderRadius: 999,
              background: i === 0 ? 'var(--ink-900)' : 'transparent',
              color: i === 0 ? 'var(--paper-50)' : 'var(--ink-700)',
              border: i === 0 ? 'none' : '1px solid rgba(28,24,20,.14)',
              cursor: 'pointer',
            }}>{f}</span>
          ))}
        </div>
      </div>

      {/* shelf grid */}
      <div style={{ padding: '0 56px', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22, paddingBottom: 32 }}>
          {NOVELS.map(n => <ShelfCard key={n.id} novel={n} />)}
        </div>
      </div>
    </div>
  );
}

function ShelfCard({ novel }) {
  const newCount = novel.total - novel.ep;
  const statusLabel = novel.status === 'done' ? '번역 완료' : novel.status === 'queued' ? '번역 대기중' : '재시도 필요';
  return (
    <article style={{
      background: 'var(--paper-100)',
      border: '1px solid rgba(28,24,20,.08)',
      borderRadius: 'var(--r-md)',
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative',
    }}>
      {newCount > 0 && (
        <div style={{
          position: 'absolute', top: -6, right: 14,
          fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600,
          padding: '3px 8px', borderRadius: 999,
          background: 'var(--accent)', color: 'var(--paper-50)', letterSpacing: '0.08em',
        }}>+{newCount} NEW</div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <NovelCover jp={novel.jp} kr={novel.kr} w={80} h={112} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-500)', letterSpacing: '.1em' }}>{novel.ncode}</div>
          <h3 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 500,
            fontSize: 15, lineHeight: 1.2, margin: '4px 0 4px', color: 'var(--ink-900)',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{novel.kr}</h3>
          <div style={{ fontFamily: 'var(--font-jp)', fontSize: 10, color: 'var(--ink-500)', marginTop: 2 }}>{novel.author}</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>
          <span>{novel.ep}/{novel.total} 화</span>
          <span>{Math.round((novel.ep/novel.total)*100)}%</span>
        </div>
        <MiniProgress value={novel.ep} max={novel.total} color="var(--accent)" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(28,24,20,.08)', paddingTop: 10 }}>
        <StatusPill kind={novel.status} label={statusLabel} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-500)' }}>{novel.updated}</span>
      </div>
    </article>
  );
}

/* ─────────────── B · INDEX LEDGER ──────────────────────── */

function LibraryLedger() {
  return (
    <div className="frame-paper" style={{
      width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-sans)', background: 'var(--paper-50)',
    }}>
      <Masthead active="library" />

      <div style={{ padding: '36px 56px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'end' }}>
        <div>
          <Eyebrow>Index · 총 18권</Eyebrow>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontStyle: 'italic', fontSize: 64, margin: '6px 0 0', letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
            Library Ledger
          </h1>
        </div>
        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: 'var(--paper-100)',
          borderRadius: 999,
          border: '1px solid rgba(28,24,20,.1)',
          width: 280,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-500)' }}>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>제목 · 작가 · ncode 검색…</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-400)' }}>⌘K</span>
        </div>
      </div>

      {/* table */}
      <div style={{ padding: '0 56px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {/* col head */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 56px minmax(0,2.8fr) 1fr 110px 130px 90px',
          gap: 16, alignItems: 'center',
          padding: '10px 0',
          borderBottom: '1.5px solid var(--ink-900)',
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--ink-700)',
        }}>
          <span>№</span>
          <span></span>
          <span>Title · 제목</span>
          <span>Author · 작가</span>
          <span>Progress</span>
          <span>Translation</span>
          <span style={{ textAlign: 'right' }}>Updated</span>
        </div>

        {NOVELS.map((n, i) => (
          <div key={n.id} style={{
            display: 'grid', gridTemplateColumns: '36px 56px minmax(0,2.8fr) 1fr 110px 130px 90px',
            gap: 16, alignItems: 'center',
            padding: '14px 0',
            borderBottom: '1px solid rgba(28,24,20,.08)',
            fontFamily: 'var(--font-sans)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>{String(i+1).padStart(2, '0')}</span>
            <NovelCover jp={n.jp} kr={n.kr} w={42} h={60} />
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--ink-900)',
                lineHeight: 1.2, marginBottom: 3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{n.kr}</div>
              <div style={{ fontFamily: 'var(--font-jp)', fontSize: 11, color: 'var(--ink-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.jp} · <span style={{ fontFamily: 'var(--font-mono)' }}>{n.ncode}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-700)' }}>
              <div>{n.author}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-500)', marginTop: 2 }}>{n.genre}</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-700)', marginBottom: 4 }}>
                {n.ep} / {n.total}
              </div>
              <MiniProgress value={n.ep} max={n.total} color="var(--accent)" />
            </div>
            <StatusPill kind={n.status} label={n.status === 'done' ? '완료' : n.status === 'queued' ? `대기 ${n.total - n.ep}` : '재시도'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-500)', textAlign: 'right' }}>{n.updated}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LibraryShelf, LibraryLedger });
