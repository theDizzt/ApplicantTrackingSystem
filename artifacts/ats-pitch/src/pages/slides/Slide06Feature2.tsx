export default function Slide06Feature2() {
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
          <span>FEATURE 2 / 5</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>핵심 기능 2</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>이력서 관리</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.6, margin: '0 0 2.5vh 0'}}>
          한 공간에서 이력서를 작성·편집·버전 관리합니다.
        </p>
        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)'}}>
          <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '1.5vh'}}>지원 파일 형식</div>
          <div style={{display: 'flex', gap: '0.8vw'}}>
            <span style={{background: 'rgba(13,148,136,0.1)', color: '#0D9488', fontSize: '1vw', fontWeight: 600, padding: '0.5vh 1vw', borderRadius: '0.5vw'}}>PDF</span>
            <span style={{background: 'rgba(13,148,136,0.1)', color: '#0D9488', fontSize: '1vw', fontWeight: 600, padding: '0.5vh 1vw', borderRadius: '0.5vw'}}>DOCX</span>
            <span style={{background: 'rgba(13,148,136,0.1)', color: '#0D9488', fontSize: '1vw', fontWeight: 600, padding: '0.5vh 1vw', borderRadius: '0.5vw'}}>DOC</span>
            <span style={{background: 'rgba(13,148,136,0.1)', color: '#0D9488', fontSize: '1vw', fontWeight: 600, padding: '0.5vh 1vw', borderRadius: '0.5vw'}}>직접 작성</span>
          </div>
        </div>
      </div>

      {/* Right — Feature Cards */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>1</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>리치 텍스트 에디터 (TipTap)</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>서식·글머리 기호·표 등 다양한 편집 기능으로 이력서를 직접 작성</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>2</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>파일 업로드 자동 추출</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>PDF·Word 업로드 시 텍스트를 자동으로 추출해 에디터에 불러오기</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>3</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>AI 맞춤법 검사</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>한국어 문맥 기반 오류 탐지 및 자연스러운 표현으로 교정 제안</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{fontSize: '1.4vw', fontWeight: 800, color: '#0D9488', background: 'rgba(13,148,136,0.1)', width: '3vw', height: '3vw', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0}}>4</div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>직무별 버전 분리 저장</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>여러 버전의 이력서를 저장해 직무에 맞게 유연하게 관리</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 6</span>
        </div>
      </div>
    </div>
  );
}
