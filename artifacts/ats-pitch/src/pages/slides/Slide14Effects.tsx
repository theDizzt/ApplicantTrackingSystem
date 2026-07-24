export default function Slide14Effects() {
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
          <span>EXPECTED BENEFITS</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left — 지원자 */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.8vh'}}>
          <div>
            <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5vh'}}>지원자 관점</div>
            <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#1E3A5F'}}>취업 준비생에게</div>
          </div>
          <div style={{height: '1px', background: '#E2E8F0'}} />
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>서류 통과율 향상</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>제출 전 약점 제거로 합격 가능성 높임</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>시간 절약</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>서류 심사부터 면접 준비까지 일관된 흐름으로 처리</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>기술 역량 객관적 증명</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>GitHub 연동으로 말이 아닌 데이터로 역량을 증명</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right — 채용 담당자 */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{background: '#1E3A5F', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #1E3A5F', boxShadow: '0 0.5vw 2vw rgba(30,58,95,0.15)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.8vh'}}>
          <div>
            <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5vh'}}>채용 담당자 관점</div>
            <div style={{fontSize: '1.5vw', fontWeight: 800, color: '#FFFFFF'}}>기업 채용팀에게</div>
          </div>
          <div style={{height: '1px', background: 'rgba(255,255,255,0.15)'}} />
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.3vh'}}>AI 생성 서류 판별</div>
              <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5}}>지원자의 AI 의존도를 사전에 파악하는 데 활용 가능</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.3vh'}}>직무 적합도 참고 지표</div>
              <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5}}>정량화된 적합도 점수를 1차 스크리닝 참고 자료로 활용</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(13,148,136,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.3vh'}}>서류 품질 향상 기대</div>
              <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5}}>사전 자가 검토로 완성도 높은 서류 지원 증가 유도</div>
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
          <span>Page 14</span>
        </div>
      </div>
    </div>
  );
}
