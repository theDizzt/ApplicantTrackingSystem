export default function Slide10AITech() {
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
          <span>AI TECHNOLOGY</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', marginBottom: '3vh'}}>
          <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>AI 기술</div>
          <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em'}}>어떻게 분석하나요?</h2>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5vw'}}>
          <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '0.8vw', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
              <div style={{width: '1.8vw', height: '1.8vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>AI 모델</div>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>OpenAI GPT 최신 모델</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>검증된 최신 언어 모델을 사용해 정확하고 일관된 서류 분석 결과를 제공합니다</div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '0.8vw', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
              <div style={{width: '1.8vw', height: '1.8vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>한국어 최적화</div>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>한국 채용 시장 특화 설계</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>한국어 채용 공고와 이력서 특성에 맞춘 프롬프트로 현지화된 분석 결과를 생성합니다</div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '0.8vw', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
              <div style={{width: '1.8vw', height: '1.8vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>구조화 출력</div>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>JSON Schema 기반 정형 응답</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>모든 분석 결과를 일관된 구조로 반환해 점수와 피드백의 신뢰성을 보장합니다</div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '0.8vw', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
              <div style={{width: '1.8vw', height: '1.8vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>GitHub API 연동</div>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>실제 저장소 데이터 분석</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>GitHub REST API를 통해 실제 기여 이력·언어 비중을 직무 적합도 평가에 반영합니다</div>
          </div>

          <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '0.8vw', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
              <div style={{width: '1.8vw', height: '1.8vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>사람인 연동</div>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>채용 공고 스크래핑 + AI 정규화</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>실시간으로 수집한 채용 공고를 AI가 구조화해 심사에 즉시 활용할 수 있도록 가공합니다</div>
          </div>

          <div style={{background: 'rgba(13,148,136,0.07)', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid rgba(13,148,136,0.2)', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '1.5vh'}}>분석 파이프라인</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.8vh'}}>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
                <span style={{fontSize: '0.95vw', color: '#475569'}}>입력 수신 및 전처리</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
                <span style={{fontSize: '0.95vw', color: '#475569'}}>GPT 다차원 동시 분석</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
                <span style={{fontSize: '0.95vw', color: '#475569'}}>구조화 결과 파싱 및 저장</span>
              </div>
              <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
                <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
                <span style={{fontSize: '0.95vw', color: '#475569'}}>사용자 맞춤 피드백 제공</span>
              </div>
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
          <span>Page 10</span>
        </div>
      </div>
    </div>
  );
}
