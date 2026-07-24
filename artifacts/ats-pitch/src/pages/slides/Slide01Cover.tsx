export default function Slide01Cover() {
  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      backgroundColor: '#FAFBFC', fontFamily: "'Inter', sans-serif",
      padding: '3.5vh 4vw', boxSizing: 'border-box',
      display: 'grid', gridTemplateColumns: '3fr 2fr',
      gridTemplateRows: 'auto 1fr auto', gap: '2.5vh 4vw', color: '#1E3A5F'
    }}>
      {/* Header */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '2vh'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '0.8vw'}}>
          <div style={{width: '1.8vw', height: '1.8vw', backgroundColor: '#0D9488', borderRadius: '0.4vw'}} />
          <span style={{fontSize: '1.2vw', fontWeight: 700, letterSpacing: '0.02em'}}>AI 서류 심사관</span>
        </div>
        <div style={{display: 'flex', gap: '2vw', fontSize: '1vw', fontWeight: 500, color: '#64748B'}}>
          <span>PRODUCT OVERVIEW</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left — Main Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>
          AI 채용 플랫폼
        </div>
        <h1 style={{fontSize: '4.8vw', fontWeight: 800, margin: '0 0 1.8vh 0', lineHeight: 1.05, letterSpacing: '-0.02em', textWrap: 'balance'}}>
          AI 서류 심사관
        </h1>
        <p style={{fontSize: '1.4vw', color: '#475569', margin: '0 0 3.5vh 0', lineHeight: 1.55, maxWidth: '34vw', fontWeight: 400}}>
          지원 전에 AI가 먼저 심사합니다. 4개 영역 정량 점수와 맞춤 피드백, AI 면접 연습까지 한 화면에서.
        </p>
        <div style={{display: 'flex', gap: '1.5vw'}}>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', flex: 1, boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.03em'}}>서류 분석 정확도</div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: '0.8vw'}}>
              <span style={{fontSize: '3.2vw', fontWeight: 800, color: '#1E3A5F'}}>94%</span>
              <span style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', backgroundColor: 'rgba(13,148,136,0.1)', padding: '0.4vh 0.7vw', borderRadius: '2vw'}}>AI 기반</span>
            </div>
          </div>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', flex: 1, boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.03em'}}>분석 영역 수</div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: '0.8vw'}}>
              <span style={{fontSize: '3.2vw', fontWeight: 800, color: '#1E3A5F'}}>4가지</span>
              <span style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', backgroundColor: 'rgba(13,148,136,0.1)', padding: '0.4vh 0.7vw', borderRadius: '2vw'}}>정량 평가</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Score Visualization */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', boxShadow: '0 0.5vw 1.5vw rgba(30,58,95,0.05)'}}>
          <div style={{fontSize: '1.15vw', fontWeight: 600, color: '#1E3A5F', marginBottom: '3vh'}}>4개 영역 점수 분석</div>

          <div style={{marginBottom: '2.2vh'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.7vh'}}>
              <span style={{fontSize: '1vw', color: '#475569', fontWeight: 500}}>직무 적합도</span>
              <span style={{fontSize: '1vw', color: '#0D9488', fontWeight: 700}}>88</span>
            </div>
            <div style={{width: '100%', height: '0.7vh', background: '#F1F5F9', borderRadius: '2vw'}}>
              <div style={{width: '88%', height: '100%', background: '#0D9488', borderRadius: '2vw'}} />
            </div>
          </div>

          <div style={{marginBottom: '2.2vh'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.7vh'}}>
              <span style={{fontSize: '1vw', color: '#475569', fontWeight: 500}}>언어 품질</span>
              <span style={{fontSize: '1vw', color: '#0D9488', fontWeight: 700}}>76</span>
            </div>
            <div style={{width: '100%', height: '0.7vh', background: '#F1F5F9', borderRadius: '2vw'}}>
              <div style={{width: '76%', height: '100%', background: '#0D9488', borderRadius: '2vw'}} />
            </div>
          </div>

          <div style={{marginBottom: '2.2vh'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.7vh'}}>
              <span style={{fontSize: '1vw', color: '#475569', fontWeight: 500}}>AI 생성 감지</span>
              <span style={{fontSize: '1vw', color: '#0D9488', fontWeight: 700}}>92</span>
            </div>
            <div style={{width: '100%', height: '0.7vh', background: '#F1F5F9', borderRadius: '2vw'}}>
              <div style={{width: '92%', height: '100%', background: '#0D9488', borderRadius: '2vw'}} />
            </div>
          </div>

          <div style={{marginBottom: '2.2vh'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.7vh'}}>
              <span style={{fontSize: '1vw', color: '#475569', fontWeight: 500}}>전반적 완성도</span>
              <span style={{fontSize: '1vw', color: '#0D9488', fontWeight: 700}}>81</span>
            </div>
            <div style={{width: '100%', height: '0.7vh', background: '#F1F5F9', borderRadius: '2vw'}}>
              <div style={{width: '81%', height: '100%', background: '#0D9488', borderRadius: '2vw'}} />
            </div>
          </div>

          <div style={{marginTop: 'auto', padding: '1.5vh 1.5vw', background: 'rgba(13,148,136,0.07)', borderRadius: '0.8vw', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '1vw', color: '#64748B', fontWeight: 500}}>종합 점수</span>
            <span style={{fontSize: '2.2vw', fontWeight: 800, color: '#0D9488'}}>84 / 100</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>2026</span>
        </div>
      </div>
    </div>
  );
}
