export default function Slide15Support() {
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
          <span>SUPPORTED ENVIRONMENTS</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', marginBottom: '4vh'}}>
          <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>지원 환경</div>
          <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em'}}>어디서든 사용할 수 있습니다</h2>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2vw'}}>
          <div style={{background: '#FFFFFF', padding: '3vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', textAlign: 'center'}}>
            <div style={{width: '4vw', height: '4vw', background: 'rgba(13,148,136,0.1)', borderRadius: '1vw', margin: '0 auto 1.5vh auto', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: '2vw', height: '2vw', background: '#0D9488', borderRadius: '0.4vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>웹 브라우저</div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '1vh'}}>모든 주요 브라우저</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5vh'}}>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>Chrome</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>Edge</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>Safari</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>Firefox</span>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '3vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', textAlign: 'center'}}>
            <div style={{width: '4vw', height: '4vw', background: 'rgba(13,148,136,0.1)', borderRadius: '1vw', margin: '0 auto 1.5vh auto', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: '1.5vw', height: '2.5vw', background: '#0D9488', borderRadius: '0.3vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>모바일</div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '1vh'}}>반응형 웹</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5vh'}}>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>iOS Safari</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>Android Chrome</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>모바일 최적화 UI</span>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '3vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', textAlign: 'center'}}>
            <div style={{width: '4vw', height: '4vw', background: 'rgba(13,148,136,0.1)', borderRadius: '1vw', margin: '0 auto 1.5vh auto', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: '2vw', height: '2.5vw', background: '#0D9488', borderRadius: '0.2vw'}} />
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>이력서 파일</div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '1vh'}}>3가지 형식</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5vh'}}>
              <span style={{fontSize: '0.9vw', color: '#64748B', fontWeight: 600}}>PDF</span>
              <span style={{fontSize: '0.9vw', color: '#64748B', fontWeight: 600}}>DOCX</span>
              <span style={{fontSize: '0.9vw', color: '#64748B', fontWeight: 600}}>DOC</span>
            </div>
          </div>

          <div style={{background: '#FFFFFF', padding: '3vh 2vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', textAlign: 'center'}}>
            <div style={{width: '4vw', height: '4vw', background: 'rgba(13,148,136,0.1)', borderRadius: '1vw', margin: '0 auto 1.5vh auto', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{display: 'flex', gap: '0.3vw'}}>
                <div style={{width: '0.5vw', height: '2vw', background: '#0D9488', borderRadius: '0.1vw'}} />
                <div style={{width: '0.5vw', height: '1.5vw', background: '#0D9488', borderRadius: '0.1vw', marginTop: '0.5vw'}} />
                <div style={{width: '0.5vw', height: '2.5vw', background: '#0D9488', borderRadius: '0.1vw'}} />
              </div>
            </div>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.8vh'}}>서비스 언어</div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '1vh'}}>한국어 특화</div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5vh'}}>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>한국어 UI</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>한국 채용 시장 최적화</span>
              <span style={{fontSize: '0.9vw', color: '#64748B'}}>사람인 연동</span>
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
          <span>Page 15</span>
        </div>
      </div>
    </div>
  );
}
