import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  Mic2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;
const BASE = import.meta.env.BASE_URL;

type SceneProps = { sceneIndex: number };

function BaseScene({
  children,
  accent = '#2b63ff',
  className = '',
}: {
  children: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <motion.section
      className={`absolute inset-0 overflow-hidden ${className}`}
      initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0.2 }}
      animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
      exit={{ clipPath: 'inset(100% 0 0 0)', opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.82, ease: EASE }}
      style={{ ['--accent' as string]: accent }}
    >
      {children}
    </motion.section>
  );
}

export function LogoLockup({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className={`logo-lockup ${compact ? 'compact' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.9em' }}>
      <img
        src={`${BASE}assets/myats-logo.png`}
        alt=""
        style={{
          width: compact ? '3.4em' : '4.8em',
          height: compact ? '2.7em' : '3.8em',
          objectFit: 'contain',
          objectPosition: 'left center',
          filter: dark ? 'brightness(0) invert(1)' : 'none',
        }}
      />
      <div style={{ display: 'grid', gap: '.06em' }}>
        <strong className="font-display" style={{ fontSize: compact ? '1.05em' : '1.2em', letterSpacing: '-.05em', color: dark ? '#081530' : '#f5f6f8' }}>
          My ATS
        </strong>
        <span style={{ fontSize: compact ? '.58em' : '.68em', letterSpacing: '.08em', color: dark ? '#53617b' : '#aab8d4' }}>AI 서류 심사관</span>
      </div>
    </div>
  );
}

function Label({ children, accent = '#2b63ff' }: { children: React.ReactNode; accent?: string }) {
  return (
    <div className="eyebrow" style={{ color: accent, display: 'flex', alignItems: 'center', gap: '.65em' }}>
      <span style={{ width: '2.3em', height: 2, background: accent, display: 'inline-block' }} />
      {children}
    </div>
  );
}

function FloatingOrb({ x, y, size, color, duration = 7 }: { x: string; y: string; size: string; color: string; duration?: number }) {
  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, ${color}, transparent 70%)`,
        filter: 'blur(7px)',
        opacity: .5,
      }}
      animate={{ x: ['-2%', '3%', '-2%'], y: ['1%', '-4%', '1%'], scale: [1, 1.08, 1] }}
      transition={{ duration, ease: 'easeInOut', repeat: Infinity }}
    />
  );
}

export function Scene1({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-hook">
      <div className="safe" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15, duration: .55, ease: EASE }}>
          <LogoLockup compact />
        </motion.div>
        <div style={{ marginTop: 'auto', marginBottom: '11%' }}>
          <motion.div initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .35, duration: .6, ease: EASE }}>
            <Label>지원 전, 먼저 읽는 것</Label>
          </motion.div>
          <h1 className="font-display" style={{ fontSize: 'clamp(39px, 7.6vw, 102px)', lineHeight: 1.08, letterSpacing: '-.085em', margin: '.32em 0 0', maxWidth: '8.5em' }}>
            <motion.span initial={{ opacity: 0, y: 46 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .52, duration: .72, ease: EASE }}>내 서류,</motion.span>
            <br />
            <motion.span initial={{ opacity: 0, y: 46 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .64, duration: .72, ease: EASE }} style={{ color: '#6f9cff' }}>합격에 가까운가?</motion.span>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.08, duration: .6 }} style={{ margin: '1.8em 0 0', color: '#aab8d4', lineHeight: 1.7, fontSize: 'clamp(13px, 1.5vw, 20px)', maxWidth: '27em' }}>
            이력서와 채용공고를 함께 읽는<br />AI 서류 심사관, My ATS
          </motion.p>
        </div>
        <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 1.3, duration: .8, ease: EASE }} style={{ height: 1, background: 'linear-gradient(90deg, #2b63ff, transparent)', transformOrigin: 'left' }} />
      </div>
      <FloatingOrb x="57%" y="4%" size="45vw" color="#143d9c" />
      <motion.div aria-hidden="true" style={{ position: 'absolute', right: '-17%', top: '22%', width: '67%', aspectRatio: '1', border: '1px solid rgba(95,137,255,.28)', borderRadius: '50%' }} animate={{ rotate: 360 }} transition={{ duration: 26, ease: 'linear', repeat: Infinity }} />
      <motion.div aria-hidden="true" style={{ position: 'absolute', right: '7%', top: '34%', width: '12px', height: '12px', borderRadius: '50%', background: '#29d7e8', boxShadow: '0 0 0 9px rgba(41,215,232,.12)' }} animate={{ y: [0, 30, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
    </BaseScene>
  );
}

export function Scene2({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-screen" accent="#29d7e8">
      <div className="safe">
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12, duration: .5, ease: EASE }}>
          <Label accent="#29d7e8">01 / 서류 심사</Label>
          <h2 className="font-display" style={{ fontSize: 'clamp(28px, 5.2vw, 70px)', lineHeight: 1.15, letterSpacing: '-.08em', margin: '.38em 0 0' }}>
            채용공고의 언어로<br /><span style={{ color: '#72f0f3' }}>내 이력서를 다시 보다</span>
          </h2>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 70, rotate: 3 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: .42, type: 'spring', stiffness: 180, damping: 20 }}
          style={{ position: 'absolute', top: '35%', left: '2%', width: '96%', background: '#f5f2eb', color: '#081530', borderRadius: '1.1em', padding: '6% 6% 5%', boxShadow: '0 25px 50px rgba(0,0,0,.24)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'clamp(10px, 1.2vw, 16px)', color: '#66708a' }}>
            <span>서류 심사 리포트</span><span style={{ color: '#20a7bb', fontWeight: 800 }}>분석 완료</span>
          </div>
          <div style={{ height: 1, background: '#dbe0e9', margin: '5% 0 6%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5%' }}>
            <div style={{ borderRight: '1px solid #dbe0e9' }}>
              <span className="micro" style={{ color: '#66708a' }}>종합 점수</span>
              <div className="font-display" style={{ fontSize: 'clamp(40px, 8vw, 104px)', lineHeight: 1, letterSpacing: '-.09em', color: '#103b9b', marginTop: '.18em' }}>82<span style={{ fontSize: '.3em', letterSpacing: 0, color: '#66708a' }}>/100</span></div>
            </div>
            <div style={{ display: 'grid', gap: '6%' }}>
              {['직무 적합도', '언어 품질', '유사도'].map((item, i) => (
                <div key={item}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'clamp(9px, 1.1vw, 14px)', color: '#53617b', marginBottom: '.35em' }}><span>{item}</span><strong style={{ color: '#103b9b' }}>{[87, 78, 81][i]}</strong></div>
                  <div style={{ height: 5, background: '#dbe0e9', borderRadius: 99, overflow: 'hidden' }}><motion.div initial={{ scaleX: 0 }} animate={{ scaleX: [0, [0.87, .78, .81][i]] }} transition={{ delay: .85 + i * .14, duration: .6, ease: EASE }} style={{ height: '100%', transformOrigin: 'left', background: i === 1 ? '#29d7e8' : '#2b63ff', borderRadius: 99 }} /></div>
                </div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: .45 }} style={{ marginTop: '7%', padding: '4% 4.5%', background: '#e8edf6', borderRadius: '.6em', display: 'flex', alignItems: 'center', gap: '.7em', fontSize: 'clamp(10px, 1.2vw, 16px)', color: '#263451' }}>
            <Sparkles size="1.15em" color="#2b63ff" /><span>공고 핵심 키워드 6개가 반영됐어요</span>
          </motion.div>
        </motion.div>
        <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} style={{ position: 'absolute', right: '-4%', bottom: '5%', width: '26%', height: 1, background: '#29d7e8', transform: 'rotate(-38deg)' }} />
      </div>
    </BaseScene>
  );
}

export function Scene3({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-interview">
      <div className="safe">
        <Label>02 / AI 면접 연습</Label>
        <motion.h2 initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .22, duration: .6, ease: EASE }} className="font-display" style={{ fontSize: 'clamp(31px, 6vw, 82px)', lineHeight: 1.1, letterSpacing: '-.09em', margin: '.38em 0 0', maxWidth: '8em' }}>
          회사마다<br /><span style={{ color: '#6f9cff' }}>다른 질문</span>이 필요하니까
        </motion.h2>
        <div style={{ position: 'absolute', top: '38%', left: 0, width: '100%' }}>
          {[
            ['01', '지원 직무에서 가장 먼저 해결하고 싶은 문제는?'],
            ['02', '우리 조직의 방식과 맞닿은 경험은?'],
            ['03', '입사 후 90일, 무엇을 바꾸고 싶나요?'],
          ].map(([num, text], i) => (
            <motion.div key={num} initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .55 + i * .23, duration: .58, ease: EASE }} style={{ display: 'flex', alignItems: 'stretch', gap: '4%', marginBottom: '4%', padding: '5% 5%', border: '1px solid rgba(111,156,255,.36)', borderRadius: '.85em', background: i === 1 ? 'rgba(36,75,165,.46)' : 'rgba(11,30,70,.56)', backdropFilter: 'blur(10px)' }}>
              <span className="font-display" style={{ color: '#29d7e8', fontSize: 'clamp(14px, 2vw, 25px)', minWidth: '1.2em' }}>{num}</span>
              <span style={{ color: '#eef3ff', fontSize: 'clamp(13px, 1.6vw, 21px)', lineHeight: 1.55 }}>{text}</span>
              <ArrowUpRight size="1em" color="#6f9cff" style={{ marginLeft: 'auto', minWidth: '1em' }} />
            </motion.div>
          ))}
        </div>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.4, duration: 1, ease: EASE }} style={{ position: 'absolute', bottom: '4%', left: 0, width: '70%', height: 1, background: 'linear-gradient(90deg, #2b63ff, transparent)', transformOrigin: 'left' }} />
      </div>
      <FloatingOrb x="-18%" y="61%" size="62vw" color="#17317f" duration={8} />
    </BaseScene>
  );
}

export function Scene4({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-career" accent="#ffbd5b">
      <div className="safe">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .12 }}>
          <Label accent="#ffbd5b">03 / 커리어 분석</Label>
          <h2 className="font-display" style={{ fontSize: 'clamp(30px, 5.5vw, 74px)', lineHeight: 1.14, letterSpacing: '-.08em', margin: '.4em 0 0', maxWidth: '9em' }}>
            지금의 경험이<br /><span style={{ color: '#ffcc83' }}>어디로 이어질지</span>
          </h2>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: .9, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: .5, duration: .75, ease: EASE }} style={{ position: 'absolute', top: '39%', left: '1%', right: '1%', background: '#101f43', border: '1px solid rgba(255,189,91,.35)', borderRadius: '1.2em', padding: '6%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.65em', color: '#aab8d4', fontSize: 'clamp(10px, 1.2vw, 15px)' }}><TrendingUp size="1.2em" color="#ffbd5b" /> 커리어 인사이트</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: '7%', marginTop: '7%' }}>
            <div>
              <span className="micro" style={{ color: '#8290ad' }}>추천 NCS 수준</span>
              <div className="font-display" style={{ fontSize: 'clamp(43px, 8vw, 108px)', color: '#ffcc83', lineHeight: 1, letterSpacing: '-.1em', margin: '.15em 0 .08em' }}>Lv. 5</div>
              <span style={{ color: '#eef3ff', fontSize: 'clamp(12px, 1.4vw, 18px)' }}>서비스 기획 · 데이터 기반</span>
            </div>
            <div style={{ borderLeft: '1px solid rgba(170,184,212,.23)', paddingLeft: '9%' }}>
              <span className="micro" style={{ color: '#8290ad' }}>연봉 가이드</span>
              <div className="font-display" style={{ fontSize: 'clamp(27px, 4.2vw, 55px)', color: '#eef3ff', letterSpacing: '-.08em', marginTop: '.35em' }}>4,200<span style={{ fontSize: '.4em', letterSpacing: 0, color: '#aab8d4' }}>만원+</span></div>
              <span style={{ color: '#8290ad', fontSize: 'clamp(10px, 1.15vw, 15px)' }}>경력·지역 기준 참고</span>
            </div>
          </div>
          <div style={{ marginTop: '8%', display: 'flex', flexWrap: 'wrap', gap: '.55em' }}>
            {['추천 직무 3개', '강점 키워드 8개', '표현·날짜 이슈'].map((text, i) => <span key={text} style={{ borderRadius: 99, padding: '.52em .9em', border: `1px solid ${i === 0 ? '#ffbd5b' : 'rgba(170,184,212,.3)'}`, color: i === 0 ? '#ffcc83' : '#aab8d4', fontSize: 'clamp(9px, 1.15vw, 14px)' }}>{text}</span>)}
          </div>
        </motion.div>
      </div>
      <FloatingOrb x="67%" y="-13%" size="53vw" color="#5d3f15" duration={9} />
    </BaseScene>
  );
}

export function Scene5({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-voice" accent="#a8f3e1">
      <div className="safe">
        <Label accent="#a8f3e1">04 / 음성 자기소개서</Label>
        <motion.h2 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25, duration: .65, ease: EASE }} className="font-display" style={{ fontSize: 'clamp(32px, 6.1vw, 84px)', lineHeight: 1.12, letterSpacing: '-.09em', margin: '.4em 0 0', maxWidth: '8em' }}>
          말하듯 자연스럽게,<br /><span style={{ color: '#a8f3e1' }}>나답게 쓰는</span> 자소서
        </motion.h2>
        <motion.div initial={{ opacity: 0, y: 55 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .55, duration: .68, ease: EASE }} style={{ position: 'absolute', top: '42%', left: 0, right: 0, background: '#f5f2eb', borderRadius: '1em', color: '#081530', padding: '6%', boxShadow: '0 25px 55px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.7em' }}><div style={{ width: '2.5em', height: '2.5em', display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#dff7f1' }}><Mic2 size="1.2em" color="#1e9386" /></div><span style={{ fontSize: 'clamp(12px, 1.4vw, 18px)', fontWeight: 800 }}>음성 가이드 녹음</span></div>
            <span className="micro" style={{ color: '#1e9386' }}>00:42 / 10:00</span>
          </div>
          <div style={{ height: '5.2em', margin: '9% 0 7%', display: 'flex', alignItems: 'center', gap: '1.1%', overflow: 'hidden' }}>
            {Array.from({ length: 34 }).map((_, i) => <motion.i key={i} initial={{ height: 6 }} animate={{ height: [8 + (i % 5) * 8, 18 + ((i * 9) % 30), 8 + (i % 5) * 8] }} transition={{ delay: .6 + i * .018, duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '2.1%', borderRadius: 99, background: i < 18 ? '#2b63ff' : '#c7d2e4', display: 'block' }} />)}
          </div>
          <div style={{ height: 1, background: '#dbe0e9', marginBottom: '5%' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '.55em', color: '#53617b', fontSize: 'clamp(10px, 1.2vw, 15px)' }}><Check size="1.2em" color="#1e9386" /><span>음성을 전사하고 내 이력서에 반영합니다</span></div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} style={{ position: 'absolute', bottom: '6%', right: 0, color: '#a8f3e1', fontSize: 'clamp(10px, 1.15vw, 15px)' }}>생각을 녹음하면, 문장이 됩니다</motion.div>
      </div>
      <FloatingOrb x="-19%" y="-9%" size="52vw" color="#165f62" duration={8} />
    </BaseScene>
  );
}

export function Scene6({ sceneIndex }: SceneProps) {
  return (
    <BaseScene className="scene-close">
      <div className="safe" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, scale: .7, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: .2, type: 'spring', stiffness: 170, damping: 19 }}>
          <div style={{ width: '8.8em', height: '8.8em', borderRadius: '2em', background: '#f5f2eb', display: 'grid', placeItems: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.24)' }}>
            <img src={`${BASE}assets/myats-app-logo.png`} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6, duration: .65, ease: EASE }} style={{ marginTop: '8%' }}>
          <div className="font-display" style={{ fontSize: 'clamp(34px, 6.4vw, 86px)', letterSpacing: '-.09em', lineHeight: 1 }}>My ATS</div>
          <div style={{ color: '#aab8d4', fontSize: 'clamp(12px, 1.45vw, 19px)', letterSpacing: '.08em', marginTop: '.8em' }}>AI 서류 심사관</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: .95, duration: .75, ease: EASE }} style={{ width: '60%', height: 1, background: 'linear-gradient(90deg, transparent, #6f9cff, transparent)', margin: '9% 0' }} />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: .5 }} style={{ color: '#eef3ff', fontSize: 'clamp(15px, 1.8vw, 24px)', lineHeight: 1.7, margin: 0 }}>더 정확하게 지원하고,<br /><span style={{ color: '#6f9cff' }}>더 나답게 준비하세요.</span></motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.65, duration: .5 }} style={{ marginTop: '15%', color: '#8290ad', fontSize: 'clamp(10px, 1.2vw, 15px)', letterSpacing: '.06em' }}>resume · interview · career · voice</motion.div>
      </div>
      <FloatingOrb x="38%" y="35%" size="46vw" color="#133b9c" duration={8.5} />
    </BaseScene>
  );
}