export default function Slide12Dashboard() {
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
          <span>DASHBOARD</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left — Metrics */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.5vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>대시보드</div>
        <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: '0 0 2vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>한눈에 보는 현황</h2>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2vw'}}>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.6vh'}}>저장된 이력서</div>
            <div style={{fontSize: '2.8vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>4</div>
            <div style={{fontSize: '0.85vw', color: '#0D9488', fontWeight: 600, marginTop: '0.4vh'}}>직무별 버전 관리</div>
          </div>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.6vh'}}>이번 달 분석</div>
            <div style={{fontSize: '2.8vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>3</div>
            <div style={{fontSize: '0.85vw', color: '#0D9488', fontWeight: 600, marginTop: '0.4vh'}}>잔여 2회</div>
          </div>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.6vh'}}>심사 평균 점수</div>
            <div style={{fontSize: '2.8vw', fontWeight: 800, color: '#0D9488', lineHeight: 1}}>78</div>
            <div style={{fontSize: '0.85vw', color: '#64748B', fontWeight: 500, marginTop: '0.4vh'}}>100점 만점</div>
          </div>
          <div style={{background: '#FFFFFF', padding: '2vh 1.5vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
            <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.6vh'}}>면접 세션</div>
            <div style={{fontSize: '2.8vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>2</div>
            <div style={{fontSize: '0.85vw', color: '#0D9488', fontWeight: 600, marginTop: '0.4vh'}}>진행 완료</div>
          </div>
        </div>
      </div>

      {/* Right — Feature list */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{background: '#FFFFFF', padding: '3vh 2.5vw', borderRadius: '1vw', border: '1px solid #E2E8F0', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2vh'}}>
          <div style={{fontSize: '1.2vw', fontWeight: 700, color: '#1E3A5F', paddingBottom: '1.5vh', borderBottom: '1px solid #E2E8F0'}}>대시보드 주요 기능</div>

          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%', marginTop: '0.4vh', flexShrink: 0}} />
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>활동 현황 요약</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>이력서 수, 분석 횟수, 심사 평균 점수를 한 화면에서 확인</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%', marginTop: '0.4vh', flexShrink: 0}} />
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>잔여 사용 횟수 표시</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>구독 플랜별 월간 잔여 횟수를 실시간으로 확인</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%', marginTop: '0.4vh', flexShrink: 0}} />
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>최근 분석 결과 빠른 접근</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>최근 심사 결과와 면접 세션으로 바로 이동</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1.2vw', alignItems: 'flex-start'}}>
            <div style={{width: '0.8vw', height: '0.8vw', background: '#0D9488', borderRadius: '50%', marginTop: '0.4vh', flexShrink: 0}} />
            <div>
              <div style={{fontSize: '1.05vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.3vh'}}>점수 추이 시각화</div>
              <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>시간별 평균 점수 변화로 실력 향상 과정을 확인</div>
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
          <span>Page 12</span>
        </div>
      </div>
    </div>
  );
}
