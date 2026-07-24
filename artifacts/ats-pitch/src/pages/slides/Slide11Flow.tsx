export default function Slide11Flow() {
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
          <span>SERVICE FLOW</span>
          <span>2026</span>
        </div>
      </div>

      {/* Content */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{textAlign: 'center', marginBottom: '4vh'}}>
          <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '0.8vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>서비스 이용 플로우</div>
          <h2 style={{fontSize: '2.8vw', fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em'}}>처음부터 끝까지 이어지는 취업 준비 사이클</h2>
        </div>

        {/* 5-Step horizontal flow */}
        <div style={{display: 'flex', alignItems: 'stretch', gap: 0}}>

          {/* Step 1 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1vw', padding: '2.5vh 1.5vw', width: '100%', boxSizing: 'border-box', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div style={{width: '3.5vw', height: '3.5vw', background: '#0D9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
                <span style={{fontSize: '1.4vw', fontWeight: 800, color: '#FFFFFF'}}>1</span>
              </div>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>STEP 1</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>이력서 등록</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>직접 작성 또는 PDF 업로드로 이력서를 등록합니다</div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{display: 'flex', alignItems: 'center', padding: '0 0.8vw', flexShrink: 0}}>
            <div style={{width: '2vw', height: '0.2vh', background: '#CBD5E1'}} />
            <div style={{width: 0, height: 0, borderTop: '0.6vh solid transparent', borderBottom: '0.6vh solid transparent', borderLeft: '0.8vw solid #CBD5E1'}} />
          </div>

          {/* Step 2 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1vw', padding: '2.5vh 1.5vw', width: '100%', boxSizing: 'border-box', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div style={{width: '3.5vw', height: '3.5vw', background: '#0D9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
                <span style={{fontSize: '1.4vw', fontWeight: 800, color: '#FFFFFF'}}>2</span>
              </div>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>STEP 2</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>채용 공고 수집</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>회사명 검색 또는 URL 입력으로 공고를 가져옵니다</div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{display: 'flex', alignItems: 'center', padding: '0 0.8vw', flexShrink: 0}}>
            <div style={{width: '2vw', height: '0.2vh', background: '#CBD5E1'}} />
            <div style={{width: 0, height: 0, borderTop: '0.6vh solid transparent', borderBottom: '0.6vh solid transparent', borderLeft: '0.8vw solid #CBD5E1'}} />
          </div>

          {/* Step 3 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{background: '#0D9488', border: '1px solid #0D9488', borderRadius: '1vw', padding: '2.5vh 1.5vw', width: '100%', boxSizing: 'border-box', boxShadow: '0 0.3vw 1.5vw rgba(13,148,136,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div style={{width: '3.5vw', height: '3.5vw', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
                <span style={{fontSize: '1.4vw', fontWeight: 800, color: '#FFFFFF'}}>3</span>
              </div>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>STEP 3</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.8vh'}}>AI 서류 심사</div>
              <div style={{fontSize: '0.9vw', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5}}>점수 확인 및 개선 피드백을 적용합니다</div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{display: 'flex', alignItems: 'center', padding: '0 0.8vw', flexShrink: 0}}>
            <div style={{width: '2vw', height: '0.2vh', background: '#CBD5E1'}} />
            <div style={{width: 0, height: 0, borderTop: '0.6vh solid transparent', borderBottom: '0.6vh solid transparent', borderLeft: '0.8vw solid #CBD5E1'}} />
          </div>

          {/* Step 4 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1vw', padding: '2.5vh 1.5vw', width: '100%', boxSizing: 'border-box', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div style={{width: '3.5vw', height: '3.5vw', background: '#0D9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
                <span style={{fontSize: '1.4vw', fontWeight: 800, color: '#FFFFFF'}}>4</span>
              </div>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>STEP 4</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>이력서 수정</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>피드백 기반으로 이력서를 보완합니다</div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{display: 'flex', alignItems: 'center', padding: '0 0.8vw', flexShrink: 0}}>
            <div style={{width: '2vw', height: '0.2vh', background: '#CBD5E1'}} />
            <div style={{width: 0, height: 0, borderTop: '0.6vh solid transparent', borderBottom: '0.6vh solid transparent', borderLeft: '0.8vw solid #CBD5E1'}} />
          </div>

          {/* Step 5 */}
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div style={{background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '1vw', padding: '2.5vh 1.5vw', width: '100%', boxSizing: 'border-box', boxShadow: '0 0.3vw 1vw rgba(30,58,95,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
              <div style={{width: '3.5vw', height: '3.5vw', background: '#0D9488', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5vh'}}>
                <span style={{fontSize: '1.4vw', fontWeight: 800, color: '#FFFFFF'}}>5</span>
              </div>
              <div style={{fontSize: '0.85vw', fontWeight: 600, color: '#0D9488', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6vh'}}>STEP 5</div>
              <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.8vh'}}>AI 면접 연습</div>
              <div style={{fontSize: '0.9vw', color: '#64748B', lineHeight: 1.5}}>약점 기반 면접으로 최종 합격을 준비합니다</div>
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
          <span>Page 11</span>
        </div>
      </div>
    </div>
  );
}
