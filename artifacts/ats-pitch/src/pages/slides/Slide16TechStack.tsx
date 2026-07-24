export default function Slide16TechStack() {
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
          <span>TECH STACK</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>기술 스택</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 1.5vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>검증된 오픈소스 기술</h2>
        <p style={{fontSize: '1.2vw', color: '#475569', lineHeight: 1.6, margin: '0 0 2.5vh 0'}}>
          안정적이고 확장 가능한 구조로 설계된 모노레포 아키텍처입니다.
        </p>
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.2vh'}}>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'center', background: '#FFFFFF', padding: '1.5vh 1.5vw', borderRadius: '0.6vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.6vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '0.8vw', fontWeight: 700, color: '#FFFFFF', background: '#0D9488', padding: '0.3vh 0.7vw', borderRadius: '0.3vw', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0}}>FE</span>
            <span style={{fontSize: '1vw', color: '#475569'}}>React · Vite · TailwindCSS · TipTap</span>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'center', background: '#FFFFFF', padding: '1.5vh 1.5vw', borderRadius: '0.6vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.6vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '0.8vw', fontWeight: 700, color: '#FFFFFF', background: '#1E3A5F', padding: '0.3vh 0.7vw', borderRadius: '0.3vw', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0}}>BE</span>
            <span style={{fontSize: '1vw', color: '#475569'}}>Node.js · Express · Drizzle ORM</span>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'center', background: '#FFFFFF', padding: '1.5vh 1.5vw', borderRadius: '0.6vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.6vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '0.8vw', fontWeight: 700, color: '#FFFFFF', background: '#0D9488', padding: '0.3vh 0.7vw', borderRadius: '0.3vw', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0}}>DB</span>
            <span style={{fontSize: '1vw', color: '#475569'}}>PostgreSQL 15</span>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'center', background: '#FFFFFF', padding: '1.5vh 1.5vw', borderRadius: '0.6vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.6vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '0.8vw', fontWeight: 700, color: '#FFFFFF', background: '#1E3A5F', padding: '0.3vh 0.7vw', borderRadius: '0.3vw', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0}}>AI</span>
            <span style={{fontSize: '1vw', color: '#475569'}}>OpenAI GPT API</span>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'center', background: '#FFFFFF', padding: '1.5vh 1.5vw', borderRadius: '0.6vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.6vw rgba(30,58,95,0.04)'}}>
            <span style={{fontSize: '0.8vw', fontWeight: 700, color: '#FFFFFF', background: '#0D9488', padding: '0.3vh 0.7vw', borderRadius: '0.3vw', textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0}}>IaC</span>
            <span style={{fontSize: '1vw', color: '#475569'}}>Docker · Nginx · 4 vCore / 8 GB 전용 서버</span>
          </div>
        </div>
      </div>

      {/* Right — Architecture Diagram */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
          <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.5vh'}}>pnpm 모노레포 구조</div>

          <div style={{background: '#FAFBFC', borderRadius: '0.6vw', padding: '1.5vh 1.5vw', border: '1px solid #E2E8F0'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh'}}>artifacts/</div>
            <div style={{paddingLeft: '1.2vw', display: 'flex', flexDirection: 'column', gap: '0.4vh'}}>
              <div style={{fontSize: '0.9vw', color: '#475569'}}>job-doc-check/ <span style={{color: '#94A3B8'}}>— React 프론트엔드</span></div>
              <div style={{fontSize: '0.9vw', color: '#475569'}}>api-server/ <span style={{color: '#94A3B8'}}>— Express API 서버</span></div>
            </div>
          </div>

          <div style={{background: '#FAFBFC', borderRadius: '0.6vw', padding: '1.5vh 1.5vw', border: '1px solid #E2E8F0'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh'}}>lib/</div>
            <div style={{paddingLeft: '1.2vw', display: 'flex', flexDirection: 'column', gap: '0.4vh'}}>
              <div style={{fontSize: '0.9vw', color: '#475569'}}>db/ <span style={{color: '#94A3B8'}}>— Drizzle ORM 스키마</span></div>
              <div style={{fontSize: '0.9vw', color: '#475569'}}>api-zod/ <span style={{color: '#94A3B8'}}>— Zod 타입 공유</span></div>
              <div style={{fontSize: '0.9vw', color: '#475569'}}>api-spec/ <span style={{color: '#94A3B8'}}>— OpenAPI 스펙</span></div>
            </div>
          </div>

          <div style={{display: 'flex', gap: '0.8vw', marginTop: '0.5vh'}}>
            <div style={{background: 'rgba(13,148,136,0.1)', padding: '0.8vh 1vw', borderRadius: '0.5vw', flex: 1, textAlign: 'center'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase'}}>TypeScript</div>
              <div style={{fontSize: '0.9vw', color: '#475569', marginTop: '0.3vh'}}>전체 타입 안전</div>
            </div>
            <div style={{background: 'rgba(30,58,95,0.07)', padding: '0.8vh 1vw', borderRadius: '0.5vw', flex: 1, textAlign: 'center'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#1E3A5F', textTransform: 'uppercase'}}>esbuild</div>
              <div style={{fontSize: '0.9vw', color: '#475569', marginTop: '0.3vh'}}>빠른 번들링</div>
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
          <span>Page 16</span>
        </div>
      </div>
    </div>
  );
}
