export default function Slide07Feature3() {
  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif",
      padding: '3.5vh 4vw', boxSizing: 'border-box',
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'auto 1fr auto', gap: '2.5vh 4vw', color: '#1E3A5F'
    }}>
      {/* Header */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '2vh'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.8vw'}}>
          <div style={{width: '1.8vw', height: '1.8vw', backgroundColor: '#0D9488', borderRadius: '0.4vw'}} />
          <span style={{fontSize: '1.2vw', fontWeight: 700}}>AI 서류 심사관</span>
        </div>
        <div style={{display: 'flex', gap: '2vw', fontSize: '1vw', fontWeight: 500, color: '#64748B'}}>
          <span>FEATURE 3 / 5</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>핵심 기능 3</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>채용 공고 자동 수집</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.6, margin: '0 0 2.5vh 0'}}>
          회사명·직무 키워드만 입력하면 공고를 자동으로 가져옵니다.
        </p>
        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
          <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '1vh'}}>연동 플랫폼</div>
          <div style={{display: 'flex', alignItems: 'center', gap: '1vw'}}>
            <span style={{background: 'rgba(13,148,136,0.1)', color: '#0D9488', fontSize: '1.1vw', fontWeight: 700, padding: '0.6vh 1.2vw', borderRadius: '0.5vw'}}>사람인</span>
            <span style={{fontSize: '1vw', color: '#64748B'}}>실시간 채용 공고 수집</span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>1</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>사람인 공고 실시간 수집</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>키워드 검색만으로 최신 채용 공고를 자동으로 수집</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>2</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>AI 공고 정규화</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>AI가 공고를 정리해 경력·학력·모집 분야로 구조화</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>3</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>기업 맞춤 추천</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>이력서 내용과 유사한 포지션을 AI가 자동으로 추천</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>4</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>지원 회사별 공고 저장</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>저장된 공고가 심사 시 자동 참조되어 편리하게 분석</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 7</span>
        </div>
      </div>
    </div>
  );
}
