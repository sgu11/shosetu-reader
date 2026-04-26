/* SETTINGS — single screen, tabbed feel */

function SettingsScreen() {
  return (
    <div className="frame-paper paper-grain" style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
      <Masthead active="settings" />

      <div style={{ padding: '36px 56px 16px' }}>
        <Eyebrow>Preferences · 환경 설정</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 56, margin: '6px 0 0', letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>
          <span style={{ fontStyle: 'italic' }}>설정</span> Settings
        </h1>
      </div>

      <div style={{ padding: '0 56px', flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 32 }}>
        {/* sidebar */}
        <nav style={{ borderRight: '1px solid rgba(28,24,20,.1)', paddingRight: 24, paddingTop: 16 }}>
          {[
            { l: '계정 · 프로필', a: false },
            { l: '읽기 환경', a: true },
            { l: '번역', a: false },
            { l: '용어집·스타일', a: false },
            { l: '비용 한도', a: false },
            { l: '데이터·동기화', a: false },
          ].map(s => (
            <div key={s.l} style={{
              fontFamily: s.a ? 'var(--font-serif)' : 'var(--font-sans)',
              fontStyle: s.a ? 'italic' : 'normal',
              fontSize: s.a ? 16 : 13,
              padding: '8px 0', cursor: 'pointer',
              color: s.a ? 'var(--ink-900)' : 'var(--ink-600)',
              borderRight: s.a ? '2px solid var(--accent)' : 'none',
              marginRight: -25, paddingRight: 14,
              fontWeight: s.a ? 500 : 400,
            }}>{s.l}</div>
          ))}
        </nav>

        {/* content */}
        <div style={{ overflowY: 'auto', paddingBottom: 32, paddingRight: 8 }} className="no-scrollbar">
          <SettingRow label="기본 글꼴 (UI)" hint="Korean-optimized · Pretendard 권장">
            <Segmented options={['Pretendard', 'Spoqa Han', 'Noto Sans KR']} active={0} />
          </SettingRow>
          <SettingRow label="본문 글꼴" hint="번역 본문에 적용. 일본어 원문은 Noto Serif JP 고정.">
            <Segmented options={['Newsreader', 'Source Serif', 'Pretendard']} active={0} />
          </SettingRow>

          <SettingRow label="글자 크기" hint="14 pt – 22 pt">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: 'var(--ink-500)' }}>A</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(28,24,20,.08)', borderRadius: 2, position: 'relative' }}>
                <div style={{ width: '52%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                <div style={{ position: 'absolute', left: '52%', top: '50%', transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: 999, background: 'var(--paper-50)', border: '2px solid var(--accent)' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink-700)' }}>A</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)', minWidth: 32 }}>17pt</span>
            </div>
          </SettingRow>

          <SettingRow label="줄 간격" hint="1.4 – 2.2">
            <Segmented options={['좁게 1.5', '기본 1.85', '넓게 2.1']} active={1} />
          </SettingRow>

          <SettingRow label="테마" hint="시스템 따라가기 · 라이트 · 다크 · 세피아">
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { l: '시스템', bg: 'linear-gradient(90deg, var(--paper-50) 50%, var(--night-900) 50%)' },
                { l: '페이퍼', bg: 'var(--paper-50)' },
                { l: '세피아', bg: '#f1e2c7' },
                { l: '나이트', bg: 'var(--night-900)' },
              ].map((t, i) => (
                <div key={t.l} style={{
                  width: 80, padding: 8, borderRadius: 'var(--r-sm)',
                  border: i === 1 ? '2px solid var(--accent)' : '1px solid rgba(28,24,20,.12)',
                  cursor: 'pointer',
                }}>
                  <div style={{ height: 32, borderRadius: 3, background: t.bg, border: '1px solid rgba(28,24,20,.06)', marginBottom: 6 }} />
                  <div style={{ fontSize: 11, color: 'var(--ink-700)', textAlign: 'center' }}>{t.l}</div>
                </div>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="기본 번역 모델" hint="에피소드별 모델은 리더에서 변경 가능합니다.">
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--paper-100)', border: '1px solid rgba(28,24,20,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 380,
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--ink-900)', fontWeight: 500 }}>Claude Sonnet 4.5</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-500)' }}>anthropic / sonnet-4.5 · $3 / $15 per 1M</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>변경 ↓</span>
            </div>
          </SettingRow>

          <SettingRow label="비용 한도" hint="이번 달 누적 $4.21 / $20.00">
            <div>
              <div style={{ height: 6, background: 'rgba(28,24,20,.08)', borderRadius: 6, overflow: 'hidden', maxWidth: 380 }}>
                <div style={{ width: '21%', height: '100%', background: 'var(--accent)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 380, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)', marginTop: 6 }}>
                <span>$4.21</span><span>한도 도달 시 일괄 번역 자동 정지</span><span>$20.00</span>
              </div>
            </div>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div style={{
      padding: '20px 0', borderBottom: '1px solid rgba(28,24,20,.08)',
      display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'flex-start',
    }}>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--ink-900)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 3, lineHeight: 1.5 }}>{hint}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Segmented({ options, active }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--paper-100)', borderRadius: 999, border: '1px solid rgba(28,24,20,.08)' }}>
      {options.map((o, i) => (
        <span key={o} style={{
          fontSize: 11.5, padding: '6px 14px', borderRadius: 999,
          background: i === active ? 'var(--ink-900)' : 'transparent',
          color: i === active ? 'var(--paper-50)' : 'var(--ink-700)',
          fontWeight: i === active ? 500 : 400, cursor: 'pointer',
        }}>{o}</span>
      ))}
    </div>
  );
}

Object.assign(window, { SettingsScreen });
