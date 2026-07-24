export default function Slide02ToC() {
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
          <span>TABLE OF CONTENTS</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>목차</div>
        <h2 style={{fontSize: '3vw', fontWeight: 800, margin: '0 0 3vh 0', lineHeight: 1.1, letterSpacing: '-0.02em'}}>발표 순서</h2>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5vh 4vw'}}>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>01</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>문제 정의</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>왜 서류 심사가 어려운가</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>02</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>솔루션</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>AI 서류 심사관 소개</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>03</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>핵심 기능 5가지</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>심사 · 관리 · 수집 · GitHub · 면접</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>04</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>AI 기술 및 서비스 플로우</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>분석 방식 · 이용 사이클</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>05</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>구독 플랜</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>Free · 베이직 · 프리미엄</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: '#FFFFFF', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>06</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>기대 효과 및 기술 스택</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>성과 · 지원 환경 · 인프라</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.5vw', alignItems: 'center', background: 'rgba(13,148,136,0.06)', padding: '1.8vh 2vw', borderRadius: '0.8vw', border: '1px solid rgba(13,148,136,0.2)', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)', gridColumn: '1 / -1', maxWidth: '48%'}}>
            <span style={{fontSize: '1.8vw', fontWeight: 800, color: '#0D9488', minWidth: '2.5vw'}}>07</span>
            <div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F'}}>도입 문의</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>연락처 및 시작 방법</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 2</span>
        </div>
      </div>
    </div>
  );
}
