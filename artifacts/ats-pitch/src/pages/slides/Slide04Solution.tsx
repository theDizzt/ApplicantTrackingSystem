export default function Slide04Solution() {
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
          <span>SOLUTION OVERVIEW</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>솔루션</div>
        <h2 style={{fontSize: '3vw', fontWeight: 800, margin: '0 0 2vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>AI 서류 심사관이란?</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.65, margin: '0 0 3vh 0'}}>
          이력서와 채용 공고를 함께 분석해 합격 가능성을 점수로 보여주는 AI 플랫폼입니다.
        </p>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.2vh'}}>
          <div style={{display: 'flex', gap: '1vw', alignItems: 'center'}}>
            <div style={{width: '0.6vw', height: '0.6vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
            <span style={{fontSize: '1.1vw', color: '#475569', lineHeight: 1.5}}>제출 전에 약점을 발견하고 개선 방향을 제시</span>
          </div>
          <div style={{display: 'flex', gap: '1vw', alignItems: 'center'}}>
            <div style={{width: '0.6vw', height: '0.6vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
            <span style={{fontSize: '1.1vw', color: '#475569', lineHeight: 1.5}}>서류 심사 → 채용 공고 수집 → AI 면접 연습까지 한 화면에서</span>
          </div>
          <div style={{display: 'flex', gap: '1vw', alignItems: 'center'}}>
            <div style={{width: '0.6vw', height: '0.6vw', background: '#0D9488', borderRadius: '50%', flexShrink: 0}} />
            <span style={{fontSize: '1.1vw', color: '#475569', lineHeight: 1.5}}>OpenAI GPT 최신 모델 기반 한국어 특화 분석</span>
          </div>
        </div>
      </div>

      {/* Right — Benefit Cards */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3.5vw', height: '3.5vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>A</div>
            <div>
              <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.5vh'}}>4개 영역 정량 점수</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>직무 적합도 · 언어 품질 · AI 감지 · 완성도를 숫자로 확인</div>
            </div>
          </div>
        </div>
        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3.5vw', height: '3.5vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>B</div>
            <div>
              <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.5vh'}}>맞춤 피드백과 개선 제안</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>영역별 세부 피드백과 우선순위 개선 방향 제시</div>
            </div>
          </div>
        </div>
        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3.5vw', height: '3.5vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>C</div>
            <div>
              <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.5vh'}}>면접 연습 연계</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>약점 분석 결과를 기반으로 AI 면접 질문 자동 생성</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 4</span>
        </div>
      </div>
    </div>
  );
}
