export default function Slide13Pricing() {
  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif",
      padding: '3.5vh 4vw', boxSizing: 'border-box',
      display: 'grid', gridTemplateColumns: '1fr',
      gridTemplateRows: 'auto 1fr auto', gap: '2.5vh 0', color: '#1E3A5F'
    }}>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '2vh'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.8vw'}}>
          <div style={{width: '1.8vw', height: '1.8vw', backgroundColor: '#0D9488', borderRadius: '0.4vw'}} />
          <span style={{fontSize: '1.2vw', fontWeight: 700}}>AI 서류 심사관</span>
        </div>
        <div style={{display: 'flex', gap: '2vw', fontSize: '1vw', fontWeight: 500, color: '#64748B'}}>
          <span>PRICING PLANS</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', marginBottom: '3.5vh'}}>
          <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>구독 플랜</div>
          <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em'}}>목적에 맞는 플랜을 선택하세요</h2>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2vw'}}>
          {/* Free */}
          <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', gap: '1.5vh'}}>
            <div>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5vh'}}>Free</div>
              <div style={{fontSize: '2.5vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>무료</div>
              <div style={{fontSize: '0.9vw', color: '#94A3B8', marginTop: '0.3vh'}}>시작 플랜</div>
            </div>
            <div style={{height: '1px', background: '#E2E8F0'}} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '1vh'}}>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569'}}>월 1회 AI 서류 심사</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569'}}>이력서 관리</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569'}}>채용 공고 수집</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569'}}>AI 면접 연습</span>
              </div>
            </div>
          </div>

          {/* 베이직 */}
          <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '2px solid #0D9488', boxShadow: '0 0.5vw 2vw rgba(13,148,136,0.15)', display: 'flex', flexDirection: 'column', gap: '1.5vh', position: 'relative'}}>
            <div style={{position: 'absolute', top: '-1.5vh', left: '50%', transform: 'translateX(-50%)', background: '#0D9488', color: '#FFFFFF', fontSize: '0.8vw', fontWeight: 700, padding: '0.4vh 1.2vw', borderRadius: '2vw', whiteSpace: 'nowrap'}}>추천</div>
            <div>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5vh'}}>베이직</div>
              <div style={{fontSize: '2.5vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>월정액</div>
              <div style={{fontSize: '0.9vw', color: '#94A3B8', marginTop: '0.3vh'}}>적극적인 구직자용</div>
            </div>
            <div style={{height: '1px', background: '#E2E8F0'}} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '1vh'}}>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569', fontWeight: 600}}>월 5회 AI 서류 심사</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#475569'}}>Free 모든 기능 포함</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#0D9488', fontWeight: 600}}>상세 개선 리포트 제공</span>
              </div>
            </div>
          </div>

          {/* 프리미엄 */}
          <div style={{background: '#1E3A5F', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #1E3A5F', boxShadow: '0 0.5vw 2vw rgba(30,58,95,0.2)', display: 'flex', flexDirection: 'column', gap: '1.5vh'}}>
            <div>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5vh'}}>프리미엄</div>
              <div style={{fontSize: '2.5vw', fontWeight: 800, color: '#FFFFFF', lineHeight: 1}}>월정액</div>
              <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.5)', marginTop: '0.3vh'}}>집중 취업 준비용</div>
            </div>
            <div style={{height: '1px', background: 'rgba(255,255,255,0.15)'}} />
            <div style={{display: 'flex', flexDirection: 'column', gap: '1vh'}}>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: 'rgba(255,255,255,0.85)', fontWeight: 600}}>월 20회 AI 서류 심사</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: 'rgba(255,255,255,0.85)'}}>베이직 모든 기능 포함</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '1vw', height: '1vw', background: 'rgba(13,148,136,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <div style={{width: '0.4vw', height: '0.4vw', background: '#0D9488', borderRadius: '50%'}} />
                </div>
                <span style={{fontSize: '0.95vw', color: '#0D9488', fontWeight: 600}}>우선 처리 혜택</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{textAlign: 'center', marginTop: '2.5vh', padding: '1.5vh 2vw', background: 'rgba(13,148,136,0.07)', borderRadius: '0.8vw', border: '1px solid rgba(13,148,136,0.15)'}}>
          <span style={{fontSize: '1vw', color: '#475569'}}>모든 플랜에서 이력서 편집 · 맞춤법 검사 · 채용 공고 수집 기능 <span style={{color: '#0D9488', fontWeight: 700}}>무제한 제공</span></span>
        </div>
      </div>

      {/* Footer */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 13</span>
        </div>
      </div>
    </div>
  );
}
