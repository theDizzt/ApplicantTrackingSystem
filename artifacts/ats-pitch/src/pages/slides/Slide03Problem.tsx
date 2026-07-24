export default function Slide03Problem() {
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
          <span>PROBLEM STATEMENT</span>
          <span>2026</span>
        </div>
      </div>

      {/* Left */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: '1.1vw', fontWeight: 600, color: '#0D9488', marginBottom: '1vh', textTransform: 'uppercase', letterSpacing: '0.06em'}}>문제 정의</div>
        <h2 style={{fontSize: '3.2vw', fontWeight: 800, margin: '0 0 2vh 0', lineHeight: 1.1, letterSpacing: '-0.02em', textWrap: 'balance'}}>서류 합격, 왜 이렇게 어려울까?</h2>
        <p style={{fontSize: '1.3vw', color: '#475569', lineHeight: 1.6, maxWidth: '32vw', margin: '0 0 3vh 0'}}>
          취업 준비생 대부분이 서류 단계에서 탈락합니다. 무엇이 부족했는지 알 수 없고, 매번 처음부터 다시 시작합니다.
        </p>
        <div style={{background: 'rgba(13,148,136,0.07)', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid rgba(13,148,136,0.2)'}}>
          <div style={{fontSize: '0.9vw', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5vh'}}>평균 채용 경쟁률</div>
          <div style={{fontSize: '4vw', fontWeight: 800, color: '#1E3A5F', lineHeight: 1}}>30 : 1</div>
          <div style={{fontSize: '1vw', color: '#64748B', marginTop: '0.5vh'}}>서류 단계에서 대부분 탈락</div>
        </div>
      </div>

      {/* Right — Problem Cards */}
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.5vh'}}>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <div style={{width: '1vw', height: '1vw', background: '#EF4444', borderRadius: '50%'}} />
          </div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>피드백 없는 탈락</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>지원자는 어디가 부족한지 피드백을 받지 못합니다</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <div style={{width: '1vw', height: '1vw', background: '#EF4444', borderRadius: '50%'}} />
          </div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>AI 서류 판별 어려움</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>채용 담당자는 AI 작성 서류를 걸러내기 어렵습니다</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <div style={{width: '1vw', height: '1vw', background: '#EF4444', borderRadius: '50%'}} />
          </div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>공고 분석에 드는 시간</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>직무마다 달라지는 공고를 일일이 분석하기 번거롭습니다</div>
          </div>
        </div>
        <div style={{display: 'flex', gap: '1.5vw', alignItems: 'flex-start', background: '#FFFFFF', padding: '2vh 2vw', borderRadius: '0.8vw', border: '1px solid #E2E8F0', boxShadow: '0 0.2vw 0.8vw rgba(30,58,95,0.04)'}}>
          <div style={{width: '2.5vw', height: '2.5vw', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <div style={{width: '1vw', height: '1vw', background: '#EF4444', borderRadius: '50%'}} />
          </div>
          <div>
            <div style={{fontSize: '1.1vw', fontWeight: 700, color: '#1E3A5F', marginBottom: '0.4vh'}}>반복되는 수정 사이클</div>
            <div style={{fontSize: '0.95vw', color: '#64748B', lineHeight: 1.5}}>막연하게 수정하다 결국 처음과 다르지 않은 서류로 지원합니다</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '1.5vh', fontSize: '0.9vw', color: '#94A3B8', fontWeight: 500}}>
        <span>AI 서류 심사관</span>
        <div style={{display: 'flex', gap: '0.8vw'}}>
          <span>Confidential &amp; Proprietary</span>
          <span>·</span>
          <span>Page 3</span>
        </div>
      </div>
    </div>
  );
}
