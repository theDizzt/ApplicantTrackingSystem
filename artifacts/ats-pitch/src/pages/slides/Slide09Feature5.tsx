export default function Slide09Feature5() {
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
          <span>FEATURE 5 / 5</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>핵심 기능 5</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>AI 맞춤 면접 연습</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.6, margin: '0 0 2.5vh 0'}}>
          서류 심사 결과를 기반으로 약점 중심 면접 질문을 자동 생성합니다.
        </p>
        <div style={{background: 'rgba(13,148,136,0.07)', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid rgba(13,148,136,0.2)'}}>
          <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '1vh', letterSpacing: '0.04em'}}>AI 피드백 3가지 기준</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.8vh'}}>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
              <span style={{fontSize: '1.05vw', color: '#1E3A5F', fontWeight: 500}}>논리성 — 답변의 구조와 근거</span>
            </div>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
              <span style={{fontSize: '1.05vw', color: '#1E3A5F', fontWeight: 500}}>구체성 — 경험·수치 기반 근거 제시</span>
            </div>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
              <span style={{fontSize: '1.05vw', color: '#1E3A5F', fontWeight: 500}}>전달력 — 명확하고 간결한 표현</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>1</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>약점 기반 질문 도출</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>낮은 점수 영역에서 예상 압박 면접 질문을 자동 생성</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>2</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>실시간 AI 피드백</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>답변 입력 시 즉시 논리성·구체성·전달력을 평가해 제공</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>3</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>세션 이력 저장</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>면접 세션을 저장해 반복 연습 및 성장 추이를 확인</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>4</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>연속적인 취업 준비 경험</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>서류 심사 통과 후 면접까지 끊김 없는 준비 플로우 제공</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 9</span>
        </div>
      </div>
    </div>
  );
}
