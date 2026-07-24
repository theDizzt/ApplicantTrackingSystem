export default function Slide17Deploy() {
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
          <span>DEPLOYMENT</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left — Web VM */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>배포 구성</div>
        <h2 style={{fontSize: '2.5vw', fontWeight: 800, margin: '0 0 2vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>클라우드 운영 구조</h2>

        <div style={{background: '#FFFFFF', padding: '2.5vh 2vw', borderRadius: '1vw', border: '2px solid #0D9488', boxShadow: '0 0.3vw 1.5vw rgba(13,148,136,0.1)'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5vh'}}>
            <span style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F'}}>Web VM</span>
            <span style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', background: 'rgba(13,148,136,0.1)', padding: '0.3vh 0.8vw', borderRadius: '2vw'}}>4 vCore / 8 GB</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.8vh'}}>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488'}}>Node.js API 서버</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>heap 6 GB · UV_THREADPOOL=8</div>
            </div>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488'}}>Nginx 프록시</div>
              <div style={{fontSize: '0.9vw', color: '#64748B'}}>정적 파일 서빙 + /api 역방향 프록시</div>
            </div>
          </div>
        </div>

        <div style={{margin: '1.5vh 0', display: 'flex', justifyContent: 'center'}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3vh'}}>
            <div style={{width: '0.2vw', height: '1.5vh', background: '#CBD5E1'}} />
            <div style={{fontSize: '0.85vw', color: '#94A3B8', fontWeight: 500}}>내부망 연결</div>
            <div style={{width: '0.2vw', height: '1.5vh', background: '#CBD5E1'}} />
          </div>
        </div>

        <div style={{background: '#1E3A5F', padding: '2.5vh 2vw', borderRadius: '1vw', border: '1px solid #1E3A5F', boxShadow: '0 0.3vw 1.5vw rgba(30,58,95,0.15)'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5vh'}}>
            <span style={{fontSize: '1.05vw', fontWeight: 700, color: '#FFFFFF'}}>DB VM</span>
            <span style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', background: 'rgba(13,148,136,0.2)', padding: '0.3vh 0.8vw', borderRadius: '2vw'}}>4 vCore / 8 GB</span>
          </div>
          <div style={{background: 'rgba(255,255,255,0.05)', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488'}}>PostgreSQL 15</div>
            <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.7)'}}>전용 DB 서버 · 성능 튜닝 적용</div>
          </div>
        </div>
      </div>

      {/* Right — Tuning Details */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
          <div style={{fontSize: '1.15vw', fontWeight: 700, color: '#1E3A5F', paddingBottom: '1.5vh', borderBottom: '1px solid #E2E8F0'}}>PostgreSQL 성능 튜닝</div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8vw'}}>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#64748B', marginBottom: '0.3vh'}}>shared_buffers</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#0D9488'}}>2 GB</div>
              <div style={{fontSize: '0.75vw', color: '#94A3B8'}}>RAM × 25%</div>
            </div>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#64748B', marginBottom: '0.3vh'}}>effective_cache</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#0D9488'}}>6 GB</div>
              <div style={{fontSize: '0.75vw', color: '#94A3B8'}}>RAM × 75%</div>
            </div>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#64748B', marginBottom: '0.3vh'}}>max_connections</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#0D9488'}}>200</div>
              <div style={{fontSize: '0.75vw', color: '#94A3B8'}}>운영 기본값</div>
            </div>
            <div style={{background: '#FAFBFC', padding: '1.2vh 1.2vw', borderRadius: '0.5vw', border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: '0.8vw', fontWeight: 600, color: '#64748B', marginBottom: '0.3vh'}}>work_mem</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#0D9488'}}>15 MB</div>
              <div style={{fontSize: '0.75vw', color: '#94A3B8'}}>쿼리당 메모리</div>
            </div>
          </div>

          <div style={{height: '1px', background: '#E2E8F0'}} />

          <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.5vh'}}>배포 도구</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.8vh'}}>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
              <span style={{fontSize: '0.95vw', color: '#475569'}}>Docker Compose — 손쉬운 배포 및 업데이트</span>
            </div>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
              <span style={{fontSize: '0.95vw', color: '#475569'}}>tini — 컨테이너 PID 1 시그널 핸들링</span>
            </div>
            <div style={{display: 'flex', gap: '0.8vw', alignItems: 'center'}}>
              <div style={{width: '0.5vw', height: '0.5vw', background: '#0D9488', borderRadius: '50%'}} />
              <span style={{fontSize: '0.95vw', color: '#475569'}}>멀티스테이지 빌드 — 경량 프로덕션 이미지</span>
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
          <span>Page 17</span>
        </div>
      </div>
    </div>
  );
}
