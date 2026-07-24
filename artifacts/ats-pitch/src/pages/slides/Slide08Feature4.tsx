export default function Slide08Feature4() {
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
          <span>FEATURE 4 / 5</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>핵심 기능 4</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>GitHub 기술 역량 평가</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.6, margin: '0 0 2.5vh 0'}}>
          이력서에 GitHub URL을 포함하면 AI가 실제 기여 이력을 분석합니다.
        </p>
        <div style={{background: '#1E3A5F', padding: '2.5vh 2vw', borderRadius: '0.8vw'}}>
          <div style={{fontSize: '0.9vw', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '1vh', letterSpacing: '0.04em'}}>단순 자기소개를 넘어</div>
          <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3}}>객관적인 기술 증거를 제시합니다</div>
          <div style={{display: 'flex', gap: '1vw', marginTop: '1.5vh'}}>
            <span style={{background: 'rgba(13,148,136,0.3)', color: '#0D9488', fontSize: '0.9vw', fontWeight: 600, padding: '0.4vh 0.8vw', borderRadius: '0.4vw'}}>GitHub API</span>
            <span style={{background: 'rgba(13,148,136,0.3)', color: '#0D9488', fontSize: '0.9vw', fontWeight: 600, padding: '0.4vh 0.8vw', borderRadius: '0.4vw'}}>자동 분석</span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>1</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>언어 비중 분석</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>저장소별 사용 언어 비중과 커밋 활동량을 파악</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>2</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>프로젝트 품질 평가</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>저장소 구성·문서화·코드 활동 품질을 자동 평가</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>3</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>공고 기술 요건 매칭</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>채용 공고의 기술 스택과 GitHub 활동을 비교해 적합도에 반영</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>4</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>종합 점수 반영</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>분석 결과가 직무 적합도 점수에 자동으로 반영</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 8</span>
        </div>
      </div>
    </div>
  );
}
