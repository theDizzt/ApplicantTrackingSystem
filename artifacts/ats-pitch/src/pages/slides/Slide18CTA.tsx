export default function Slide18CTA() {
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
          <span>GET STARTED</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content — Centered CTA */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
        <div style={{width: '6vw', height: '6vw', backgroundColor: 'rgba(13,148,136,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3vh'}}>
          <div style={{width: '3.5vw', height: '3.5vw', background: '#0D9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div style={{width: '1.5vw', height: '0.2vw', background: '#FFFFFF', position: 'relative'}}>
              <div style={{position: 'absolute', right: '-0.1vw', top: '50%', transform: 'translateY(-50%) rotate(45deg)', width: '0.6vw', height: '0.2vw', background: '#FFFFFF', transformOrigin: 'right center'}} />
              <div style={{position: 'absolute', right: '-0.1vw', top: '50%', transform: 'translateY(-50%) rotate(-45deg)', width: '0.6vw', height: '0.2vw', background: '#FFFFFF', transformOrigin: 'right center'}} />
            </div>
          </div>
        </div>

        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>지금 시작하세요</div>
        <h1 style={{fontSize: '5vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.05, letterSpacing: '-0.02em', textWrap: 'balance'}}>
          AI 서류 심사관과 함께<br />합격률을 높여보세요
        </h1>
        <p style={{fontSize: '1.4vw', color: '#475569', margin: '0 0 4vh 0', lineHeight: 1.55, maxWidth: '50vw'}}>
          무료 플랜으로 지금 바로 시작하세요. 이력서를 등록하고 첫 번째 AI 서류 심사를 경험해보세요.
        </p>

        <div style={{display: 'flex', gap: '4vw', padding: '3vh 5vw', background: '#FFFFFF', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.5vw 2vw rgba(30,58,95,0.07)', marginBottom: '2.5vh'}}>
          <div style={{textAlign: 'left'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5vh'}}>도입 문의 및 파트너십</div>
            <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F'}}>contact@ai-ats.kr</div>
          </div>
          <div style={{width: '1px', background: '#E2E8F0'}} />
          <div style={{textAlign: 'left'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5vh'}}>기술 문서 및 API 가이드</div>
            <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F'}}>docs.ai-ats.kr</div>
          </div>
        </div>

        <div style={{display: 'flex', gap: '1.5vw'}}>
          <div style={{background: 'rgba(13,148,136,0.1)', padding: '0.8vh 2vw', borderRadius: '2vw', fontSize: '1vw', fontWeight: 600, color: '#0D9488'}}>무료로 시작</div>
          <div style={{background: 'rgba(30,58,95,0.07)', padding: '0.8vh 2vw', borderRadius: '2vw', fontSize: '1vw', fontWeight: 600, color: '#1E3A5F'}}>서류 심사 체험</div>
          <div style={{background: 'rgba(13,148,136,0.1)', padding: '0.8vh 2vw', borderRadius: '2vw', fontSize: '1vw', fontWeight: 600, color: '#0D9488'}}>면접 연습 시작</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
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
