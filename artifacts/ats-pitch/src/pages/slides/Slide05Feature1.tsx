export default function Slide05Feature1() {
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
          <span>FEATURE 1 / 5</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', marginBottom: '3vh'}}>
          <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>핵심 기능 1</div>
          <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1vh 0', lineHeight: 1.1, letterSpacing: '-0.02em'}}>AI 서류 심사</h2>
          <p style={{fontSize: '1.2vw', color: '#475569', margin: 0}}>이력서 + 채용 공고를 입력하면 4개 영역을 정량 점수로 분석합니다</p>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5vw'}}>
          <div style={{background: '#FFFFFF', padding: '2.5vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', top: 0, left: 0, width: '0.4vw', height: '100%', background: '#0D9488', borderRadius: '1vw 0 0 1vw'}} />
            <div style={{paddingLeft: '0.8vw'}}>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>직무 적합도</div>
              <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.6vh'}}>경험·기술이 공고 요건과 얼마나 일치하는가</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>이력서의 직무 경험, 보유 기술, 자격증을 채용 공고 요건과 1:1로 매칭해 일치율을 점수화합니다</div>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', top: 0, left: 0, width: '0.4vw', height: '100%', background: '#0D9488', borderRadius: '1vw 0 0 1vw'}} />
            <div style={{paddingLeft: '0.8vw'}}>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>언어 품질</div>
              <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.6vh'}}>문장 명확성, 논리 구조, 전문 용어 적절성</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>문장의 가독성, 논리적 흐름, 맞춤법·어휘 수준을 종합 평가해 언어 완성도를 수치로 제공합니다</div>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', top: 0, left: 0, width: '0.4vw', height: '100%', background: '#F59E0B', borderRadius: '1vw 0 0 1vw'}} />
            <div style={{paddingLeft: '0.8vw'}}>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>AI 생성 감지</div>
              <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.6vh'}}>채용 담당자가 기피하는 AI 작성 패턴 탐지</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>ChatGPT 등 AI가 생성한 문체 패턴을 감지해 서류의 인간 작성 비율과 자연스러움 정도를 평가합니다</div>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', position: 'relative', overflow: 'hidden'}}>
            <div style={{position: 'absolute', top: 0, left: 0, width: '0.4vw', height: '100%', background: '#0D9488', borderRadius: '1vw 0 0 1vw'}} />
            <div style={{paddingLeft: '0.8vw'}}>
              <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>전반적 완성도</div>
              <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.6vh'}}>구성, 분량, 핵심 정보 포함 여부</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>서류의 전체적인 구조, 적절한 분량, 필수 항목 포함 여부를 종합해 완성도를 최종 점수로 산출합니다</div>
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
          <span>Page 5</span>
        </div>
      </div>
    </div>
  );
}
