import "./_group.css";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  FileCheck2,
  FileSearch,
  Mic2,
  MoveUpRight,
  Sparkles,
  Target,
} from "lucide-react";

const capabilities = [
  {
    number: "01",
    icon: FileSearch,
    eyebrow: "RESUME × ROLE",
    title: "내 이력서와\n지원 공고를 함께",
    description:
      "공고의 요구사항과 이력서 내용을 나란히 살펴보고, 직무 적합도와 보완할 점을 확인합니다.",
    tags: ["이력서 분석", "공고 분석", "맞춤 피드백"],
  },
  {
    number: "02",
    icon: BriefcaseBusiness,
    eyebrow: "CAREER DIRECTION",
    title: "다음에 지원할\n직무의 기준까지",
    description:
      "경력에서 강점과 추천 직무를 찾고, NCS 수준과 직무별 가이드 연봉을 함께 살펴봅니다.",
    tags: ["추천 직무", "NCS 수준", "연봉 가이드"],
  },
  {
    number: "03",
    icon: Target,
    eyebrow: "INTERVIEW PRACTICE",
    title: "회사에 맞춘 질문으로\n답변을 연습합니다",
    description:
      "지원 회사와 이력서의 맥락을 바탕으로 질문을 만들고, 답변에 대한 AI 피드백을 제공합니다.",
    tags: ["기업별 질문", "답변 피드백"],
  },
];

function Brand() {
  return (
    <a className="mh-brand" href="/" aria-label="My ATS 홈">
      <span className="mh-brandmark">
        <img src="/__mockup/images/myats-app-logo.png" alt="" />
      </span>
      <span className="mh-brandname">
        <strong>My ATS</strong>
        <small>AI JOB PREP</small>
      </span>
    </a>
  );
}

export default function CompanyHome() {
  return (
    <div className="mh-page">
      <style>{`
        .mh-page {
          --mh-ink: #15263c;
          --mh-muted: #667487;
          --mh-paper: #f7f5ef;
          --mh-white: #fffefa;
          --mh-blue: #1457d9;
          --mh-cyan: #15bfd0;
          --mh-line: #dfe4e6;
          min-height: 100vh;
          background: var(--mh-paper);
          color: var(--mh-ink);
          font-family: 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif;
          overflow: hidden;
        }
        .mh-page * { box-sizing: border-box; }
        .mh-page a { color: inherit; text-decoration: none; }
        .mh-wrap { width: min(1160px, calc(100% - 64px)); margin: 0 auto; }
        .mh-topbar {
          height: 78px; display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid rgba(21,38,60,.1);
        }
        .mh-brand { display: inline-flex; align-items: center; gap: 11px; }
        .mh-brandmark {
          width: 37px; height: 37px; overflow: hidden; display: grid; place-items: center;
          border-radius: 11px; background: #fdfdff; box-shadow: 0 2px 8px rgba(21,38,60,.08);
        }
        .mh-brandmark img { width: 37px; height: 37px; object-fit: cover; }
        .mh-brandname { display: grid; line-height: 1.05; }
        .mh-brandname strong { font-size: 16px; letter-spacing: -.06em; font-weight: 800; }
        .mh-brandname small { margin-top: 4px; font-size: 8px; letter-spacing: .15em; color: #708095; font-weight: 700; }
        .mh-nav { display: flex; align-items: center; gap: 31px; color: #58677b; font-size: 12px; font-weight: 600; }
        .mh-nav a:not(.mh-login):hover, .mh-login:hover { color: var(--mh-blue); }
        .mh-nav-cta {
          display: inline-flex; align-items: center; gap: 9px; border-radius: 6px;
          padding: 11px 16px; color: white !important; background: var(--mh-ink);
          transition: transform .2s ease, background .2s ease;
        }
        .mh-nav-cta:hover { transform: translateY(-2px); background: var(--mh-blue); }
        .mh-hero { position: relative; padding: 76px 0 83px; }
        .mh-hero::before {
          content: ""; position: absolute; width: 560px; height: 560px; border-radius: 50%;
          right: -190px; top: 20px; background: radial-gradient(circle, rgba(28,181,199,.17), rgba(28,181,199,0) 69%);
          pointer-events: none;
        }
        .mh-hero-grid { position: relative; display: grid; grid-template-columns: .94fr 1.06fr; gap: 50px; align-items: center; }
        .mh-kicker, .mh-section-kicker {
          display: flex; align-items: center; gap: 10px; color: var(--mh-blue);
          text-transform: uppercase; font-size: 10px; letter-spacing: .17em; font-weight: 800;
        }
        .mh-kicker::before, .mh-section-kicker::before { content: ""; width: 24px; height: 1px; background: currentColor; }
        .mh-hero h1 {
          max-width: 570px; margin: 25px 0 20px; font-size: clamp(42px, 5.25vw, 67px);
          line-height: 1.2; letter-spacing: -.075em; font-weight: 800; word-break: keep-all;
        }
        .mh-hero h1 em { color: var(--mh-blue); font-style: normal; }
        .mh-lede { max-width: 430px; color: #5f6d7e; font-size: 15px; line-height: 1.9; word-break: keep-all; }
        .mh-hero-actions { display: flex; align-items: center; gap: 21px; margin-top: 31px; }
        .mh-primary {
          display: inline-flex; align-items: center; gap: 13px; padding: 15px 19px;
          background: var(--mh-blue); color: white !important; border-radius: 6px;
          font-size: 13px; font-weight: 700; box-shadow: 0 8px 22px rgba(20,87,217,.17);
          transition: transform .2s ease, box-shadow .2s ease;
        }
        .mh-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(20,87,217,.24); }
        .mh-text-link { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; }
        .mh-text-link:hover { color: var(--mh-blue); }
        .mh-aside-note { margin-top: 31px; display: flex; align-items: center; gap: 10px; color: #8390a0; font-size: 10px; }
        .mh-aside-note span { display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center; border: 1px solid #cbd3d9; border-radius: 50%; }
        .mh-demo-wrap { min-width: 0; position: relative; padding: 16px 0 18px 24px; }
        .mh-demo-wrap::before {
          content: ""; position: absolute; inset: 0 35px 0 0; transform: rotate(-2.5deg);
          border: 1px solid rgba(20,87,217,.18); border-radius: 3px; background: #eaeff0;
        }
        .mh-demo {
          position: relative; background: var(--mh-white); border: 1px solid #e1e6e5;
          border-radius: 4px; box-shadow: 0 22px 55px rgba(31,52,76,.11); padding: 24px;
        }
        .mh-demo-top { display: flex; align-items: center; justify-content: space-between; padding-bottom: 17px; border-bottom: 1px solid #edf0ef; }
        .mh-demo-label { font-size: 10px; color: #748197; font-weight: 700; letter-spacing: .08em; }
        .mh-demo-status { display: inline-flex; align-items: center; gap: 6px; border-radius: 30px; background: #edf5f0; color: #327452; padding: 6px 9px; font-size: 9px; font-weight: 700; }
        .mh-demo-status i { width: 5px; height: 5px; display: block; border-radius: 50%; background: #51a776; }
        .mh-post-title { margin: 19px 0 5px; font-size: 17px; font-weight: 800; letter-spacing: -.045em; }
        .mh-post-sub { font-size: 10px; color: #8792a0; }
        .mh-matchline { height: 1px; margin: 19px 0; background: linear-gradient(90deg, var(--mh-blue) 0 29%, #e7ebea 29% 100%); }
        .mh-compare { display: grid; grid-template-columns: 1fr 34px 1fr; gap: 9px; align-items: center; }
        .mh-compare-side { min-height: 116px; padding: 13px; background: #f7f8f6; border: 1px solid #edf0ec; }
        .mh-compare-side:last-child { background: #f1f5fb; border-color: #e4eafa; }
        .mh-compare-cap { color: #8490a0; font-size: 9px; font-weight: 700; }
        .mh-compare-side strong { display: block; margin: 9px 0; font-size: 12px; }
        .mh-pill { display: inline-flex; padding: 4px 7px; border-radius: 2px; margin: 0 3px 4px 0; background: #edf1f0; color: #667486; font-size: 8px; }
        .mh-compare-side:last-child .mh-pill { background: #e3ebfb; color: #315caa; }
        .mh-compare-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: var(--mh-blue); background: white; border: 1px solid #dce4ef; }
        .mh-insight { display: flex; align-items: flex-start; gap: 10px; padding: 14px 0 0; color: #55677c; font-size: 10px; line-height: 1.7; }
        .mh-insight svg { flex: 0 0 auto; margin-top: 1px; color: var(--mh-blue); }
        .mh-demo-foot { margin-top: 17px; padding-top: 13px; border-top: 1px solid #edf0ef; display: flex; align-items: center; justify-content: space-between; color: #8792a0; font-size: 9px; }
        .mh-demo-foot strong { color: var(--mh-ink); font-size: 10px; }
        .mh-side-stamp {
          position: absolute; bottom: -23px; right: -18px; z-index: 2; width: 107px; height: 107px;
          display: grid; place-content: center; text-align: center; border-radius: 50%;
          background: var(--mh-ink); color: white; transform: rotate(9deg); border: 5px solid var(--mh-paper);
        }
        .mh-side-stamp span { font-size: 8px; letter-spacing: .13em; color: #9eaec3; }
        .mh-side-stamp strong { margin-top: 4px; font-size: 14px; letter-spacing: -.05em; }
        .mh-ribbon { background: #e9eee9; border-top: 1px solid #dce3dc; border-bottom: 1px solid #dce3dc; }
        .mh-ribbon-inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 19px 0; }
        .mh-ribbon-label { color: #748275; font-size: 9px; text-transform: uppercase; letter-spacing: .16em; font-weight: 800; }
        .mh-ribbon-items { display: flex; gap: clamp(14px, 3vw, 42px); flex-wrap: wrap; }
        .mh-ribbon-items span { display: inline-flex; align-items: center; gap: 8px; color: #405347; font-size: 11px; font-weight: 700; }
        .mh-ribbon-items svg { color: #377659; }
        .mh-story { padding: 113px 0 103px; }
        .mh-story-grid { display: grid; grid-template-columns: .85fr 1.15fr; gap: 90px; align-items: start; }
        .mh-story h2, .mh-cap-head h2, .mh-tool-copy h2, .mh-close h2 {
          font-size: clamp(30px, 3.7vw, 45px); letter-spacing: -.075em; line-height: 1.28; margin: 19px 0;
          font-weight: 800; word-break: keep-all;
        }
        .mh-story-text { max-width: 580px; color: #5f6e7e; font-size: 14px; line-height: 2.05; word-break: keep-all; }
        .mh-quote { margin-top: 26px; padding-left: 17px; border-left: 2px solid var(--mh-cyan); font-size: 12px; font-weight: 700; line-height: 1.8; }
        .mh-story-note { display: block; margin-top: 5px; color: #8793a0; font-size: 9px; font-weight: 500; }
        .mh-capabilities { padding: 91px 0 106px; background: #fffefa; border-top: 1px solid #e7e8e2; border-bottom: 1px solid #e7e8e2; }
        .mh-cap-head { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin-bottom: 46px; }
        .mh-cap-head h2 { margin-bottom: 0; }
        .mh-cap-intro { max-width: 290px; color: #748092; font-size: 12px; line-height: 1.85; }
        .mh-cap-list { border-top: 1px solid #dfe4e3; }
        .mh-cap-row { display: grid; grid-template-columns: 70px 60px 1fr 1fr; gap: 24px; align-items: center; padding: 28px 0; border-bottom: 1px solid #e5e9e7; }
        .mh-cap-no { align-self: start; padding-top: 6px; color: #9aa4ae; font-size: 10px; font-weight: 700; letter-spacing: .12em; }
        .mh-cap-icon { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid #dfe5e8; color: var(--mh-blue); border-radius: 50%; }
        .mh-cap-title { margin: 7px 0 0; font-size: 20px; line-height: 1.45; letter-spacing: -.055em; white-space: pre-line; }
        .mh-cap-copy { max-width: 380px; color: #718092; font-size: 11px; line-height: 1.9; }
        .mh-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 13px; }
        .mh-tags span { padding: 5px 8px; border: 1px solid #e3e8e9; color: #657387; font-size: 9px; }
        .mh-tools { padding: 100px 0 108px; }
        .mh-tools-grid { display: grid; grid-template-columns: 1fr .95fr; gap: 80px; align-items: center; }
        .mh-tool-copy p { max-width: 470px; color: #667587; font-size: 13px; line-height: 2; word-break: keep-all; }
        .mh-tool-list { display: grid; gap: 14px; margin-top: 27px; }
        .mh-tool-item { display: flex; gap: 12px; align-items: flex-start; font-size: 11px; color: #526176; line-height: 1.75; }
        .mh-tool-item > span { flex: 0 0 auto; display: grid; place-items: center; width: 23px; height: 23px; color: var(--mh-blue); background: #e9effb; border-radius: 50%; }
        .mh-research-card {
          position: relative; padding: 27px 28px 24px; background: #e9eff7; min-height: 320px;
          border-radius: 2px; overflow: hidden;
        }
        .mh-research-card::after { content: ""; position: absolute; width: 220px; height: 220px; right: -90px; bottom: -80px; border: 1px solid rgba(20,87,217,.18); border-radius: 50%; box-shadow: 0 0 0 22px rgba(20,87,217,.035), 0 0 0 44px rgba(20,87,217,.025); }
        .mh-research-top { display: flex; justify-content: space-between; color: #61738b; font-size: 9px; font-weight: 800; letter-spacing: .11em; }
        .mh-research-title { margin-top: 48px; max-width: 340px; font-size: 22px; line-height: 1.5; letter-spacing: -.06em; font-weight: 800; }
        .mh-research-meta { margin-top: 9px; color: #728198; font-size: 10px; line-height: 1.8; }
        .mh-research-divider { height: 1px; margin: 23px 0 17px; background: #d1dce8; }
        .mh-research-question { display: flex; align-items: center; gap: 10px; color: #405675; font-size: 11px; font-weight: 700; }
        .mh-research-question svg { color: var(--mh-blue); }
        .mh-voice { padding: 0 0 105px; }
        .mh-voice-panel {
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 36px;
          padding: 31px 38px; color: #f7f8f8; background: var(--mh-ink); position: relative; overflow: hidden;
        }
        .mh-voice-panel::after { content: ""; position: absolute; right: 155px; top: -170px; width: 360px; height: 360px; border: 1px solid rgba(255,255,255,.12); border-radius: 50%; box-shadow: 0 0 0 35px rgba(255,255,255,.025), 0 0 0 70px rgba(255,255,255,.02); }
        .mh-voice-label { color: #8cb5fc; font-size: 9px; font-weight: 800; letter-spacing: .16em; }
        .mh-voice-panel h3 { margin: 9px 0 7px; font-size: 20px; letter-spacing: -.055em; }
        .mh-voice-panel p { margin: 0; max-width: 550px; color: #afbac8; font-size: 11px; line-height: 1.8; }
        .mh-voice-art { width: 170px; display: flex; align-items: center; justify-content: center; gap: 4px; color: #64c8d7; }
        .mh-voice-art span { width: 3px; border-radius: 5px; background: currentColor; opacity: .8; }
        .mh-voice-art span:nth-child(1), .mh-voice-art span:nth-child(9) { height: 13px; }
        .mh-voice-art span:nth-child(2), .mh-voice-art span:nth-child(8) { height: 25px; }
        .mh-voice-art span:nth-child(3), .mh-voice-art span:nth-child(7) { height: 40px; }
        .mh-voice-art span:nth-child(4), .mh-voice-art span:nth-child(6) { height: 29px; }
        .mh-voice-art span:nth-child(5) { height: 52px; }
        .mh-close { padding: 74px 0 78px; border-top: 1px solid #dce2e2; }
        .mh-close-inner { display: flex; align-items: end; justify-content: space-between; gap: 40px; }
        .mh-close h2 { max-width: 590px; margin-bottom: 10px; }
        .mh-close p { margin: 0; color: #758294; font-size: 12px; }
        .mh-close-actions { display: flex; gap: 11px; flex-shrink: 0; }
        .mh-footer { border-top: 1px solid #e1e5e3; padding: 22px 0 28px; }
        .mh-footer-inner { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .mh-footer .mh-brandmark { width: 30px; height: 30px; border-radius: 8px; }
        .mh-footer .mh-brandmark img { width: 30px; height: 30px; }
        .mh-footer .mh-brandname strong { font-size: 13px; }
        .mh-footer .mh-brandname small { font-size: 7px; }
        .mh-footer-note { color: #8c98a4; font-size: 9px; }
        .mh-footer-nav { display: flex; gap: 20px; color: #687688; font-size: 10px; font-weight: 600; }
        .mh-footer-nav a:hover { color: var(--mh-blue); }
        @media (max-width: 860px) {
          .mh-wrap { width: min(100% - 42px, 680px); }
          .mh-nav { gap: 18px; }
          .mh-hero { padding: 61px 0 66px; }
          .mh-hero-grid { grid-template-columns: 1fr; gap: 34px; }
          .mh-hero h1 { max-width: 620px; font-size: clamp(43px, 9vw, 66px); }
          .mh-lede { max-width: 550px; }
          .mh-demo-wrap { width: min(100%, 590px); margin: 0 auto; }
          .mh-story-grid { grid-template-columns: 1fr; gap: 25px; }
          .mh-story { padding: 77px 0; }
          .mh-tools-grid { grid-template-columns: 1fr; gap: 36px; }
          .mh-research-card { min-height: 275px; }
          .mh-close-inner { align-items: flex-start; flex-direction: column; }
        }
        @media (max-width: 560px) {
          .mh-wrap { width: calc(100% - 38px); }
          .mh-topbar { height: 68px; }
          .mh-nav { gap: 14px; }
          .mh-nav > a:not(.mh-nav-cta) { display: none; }
          .mh-nav-cta { padding: 10px 12px; font-size: 10px; }
          .mh-hero { padding: 52px 0 55px; }
          .mh-hero h1 { margin-top: 21px; font-size: clamp(40px, 11vw, 54px); }
          .mh-lede { font-size: 13px; }
          .mh-hero-actions { align-items: flex-start; flex-direction: column; gap: 17px; }
          .mh-demo-wrap { padding: 11px 0 12px 11px; }
          .mh-demo { padding: 17px 14px; }
          .mh-compare { grid-template-columns: 1fr 25px 1fr; gap: 5px; }
          .mh-compare-side { min-height: 108px; padding: 10px 8px; }
          .mh-compare-side strong { font-size: 10px; }
          .mh-compare-icon { width: 24px; height: 24px; }
          .mh-side-stamp { width: 84px; height: 84px; right: -4px; bottom: -20px; border-width: 4px; }
          .mh-side-stamp strong { font-size: 11px; }
          .mh-side-stamp span { font-size: 7px; }
          .mh-ribbon-inner { align-items: flex-start; flex-direction: column; padding: 16px 0; }
          .mh-ribbon-items { gap: 11px 17px; }
          .mh-ribbon-items span { font-size: 9px; }
          .mh-story { padding: 68px 0 72px; }
          .mh-story h2, .mh-cap-head h2, .mh-tool-copy h2, .mh-close h2 { font-size: 31px; }
          .mh-story-text { font-size: 12px; }
          .mh-capabilities { padding: 68px 0 72px; }
          .mh-cap-head { align-items: flex-start; flex-direction: column; gap: 13px; margin-bottom: 28px; }
          .mh-cap-row { grid-template-columns: 31px 38px 1fr; gap: 10px; align-items: start; padding: 22px 0; }
          .mh-cap-no { font-size: 8px; }
          .mh-cap-icon { width: 34px; height: 34px; }
          .mh-cap-icon svg { width: 17px; }
          .mh-cap-content { grid-column: 3; }
          .mh-cap-title { font-size: 17px; }
          .mh-cap-copy { grid-column: 3; font-size: 10px; }
          .mh-tools { padding: 72px 0; }
          .mh-research-card { padding: 23px 20px; }
          .mh-research-title { margin-top: 37px; font-size: 18px; }
          .mh-voice { padding-bottom: 70px; }
          .mh-voice-panel { grid-template-columns: 1fr; gap: 20px; padding: 25px 22px; }
          .mh-voice-art { width: 100%; justify-content: flex-start; }
          .mh-close { padding: 60px 0; }
          .mh-close-actions { width: 100%; flex-direction: column; }
          .mh-close-actions .mh-primary, .mh-close-actions .mh-secondary { justify-content: center; }
          .mh-footer-inner { align-items: flex-start; flex-direction: column; }
          .mh-footer-nav { gap: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mh-page *, .mh-page *::before, .mh-page *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; }
        }
        html:has(.mh-page) { scroll-behavior: smooth; }
        .mh-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 14px 16px; border: 1px solid #cbd3d8; border-radius: 6px; font-size: 12px; font-weight: 700; transition: border-color .2s ease, color .2s ease; }
        .mh-secondary:hover { border-color: var(--mh-blue); color: var(--mh-blue); }
      `}</style>
      <header className="mh-wrap mh-topbar">
        <Brand />
        <nav className="mh-nav" aria-label="주요 메뉴">
          <a href="#why">서비스 이야기</a>
          <a href="#features">기능</a>
          <a className="mh-login" href="/login">로그인</a>
          <a className="mh-nav-cta" href="/register">시작하기 <ArrowUpRight size={14} /></a>
        </nav>
      </header>

      <main>
        <section className="mh-hero">
          <div className="mh-wrap mh-hero-grid">
            <div>
              <div className="mh-kicker">MY ATS · 취업 준비의 다음 단계</div>
              <h1>내 경험이<br />어떤 공고와 만나는지,<br /><em>지원 전에</em> 함께 봅니다.</h1>
              <p className="mh-lede">
                이력서와 실제 채용 공고를 연결해 준비할 부분을 찾고,
                회사별 면접 연습과 자기소개서 작성까지 이어가는 AI 취업 준비 도구입니다.
              </p>
              <div className="mh-hero-actions">
                <a className="mh-primary" href="/register">내 지원 준비 시작하기 <ArrowRight size={16} /></a>
                <a className="mh-text-link" href="#how">어떻게 쓰나요? <ArrowDown size={14} /></a>
              </div>
              <div className="mh-aside-note"><span><Check size={11} /></span>기능과 안내는 서비스에서 제공하는 실제 도구를 바탕으로 합니다.</div>
            </div>

            <div className="mh-demo-wrap" aria-label="이력서와 채용 공고를 연결해 살펴보는 서비스 예시 화면">
              <div className="mh-demo">
                <div className="mh-demo-top">
                  <span className="mh-demo-label">MY ATS · 지원 준비 미리보기</span>
                  <span className="mh-demo-status"><i />분석 항목</span>
                </div>
                <div className="mh-post-title">공고와 내 경험을 연결해 보기</div>
                <div className="mh-post-sub">채용 공고의 기준과 이력서 내용을 함께 확인합니다</div>
                <div className="mh-matchline" />
                <div className="mh-compare">
                  <div className="mh-compare-side">
                    <div className="mh-compare-cap">채용 공고</div>
                    <strong>주요 요구 역량</strong>
                    <span className="mh-pill">직무 경험</span><span className="mh-pill">문제 해결</span><span className="mh-pill">협업</span>
                  </div>
                  <div className="mh-compare-icon"><MoveUpRight size={14} /></div>
                  <div className="mh-compare-side">
                    <div className="mh-compare-cap">내 이력서</div>
                    <strong>경험과 표현</strong>
                    <span className="mh-pill">프로젝트</span><span className="mh-pill">성과</span><span className="mh-pill">보완점</span>
                  </div>
                </div>
                <div className="mh-insight">
                  <Sparkles size={14} />
                  <span>공고와 이력서의 연결 지점을 확인하고, 지원서에 더 구체적으로 담을 경험을 찾아보세요.</span>
                </div>
                <div className="mh-demo-foot"><span>이력서 · 공고 분석</span></div>
              </div>
              <div className="mh-side-stamp" aria-hidden="true"><span>PREPARE WITH</span><strong>MY ATS</strong></div>
            </div>
          </div>
        </section>

        <div className="mh-ribbon">
          <div className="mh-wrap mh-ribbon-inner">
            <div className="mh-ribbon-label">준비의 흐름을 한곳에서</div>
            <div className="mh-ribbon-items">
              <span><FileCheck2 size={14} /> 이력서 점검</span>
              <span><Target size={14} /> 공고 맞춤 분석</span>
              <span><AudioLines size={14} /> 면접 · 자기소개서</span>
            </div>
          </div>
        </div>

        <section className="mh-story" id="why">
          <div className="mh-wrap mh-story-grid">
            <div>
              <div className="mh-section-kicker">WHY MY ATS</div>
              <h2>좋은 경험도<br />지원하는 곳과 연결될 때<br />더 잘 설명됩니다.</h2>
            </div>
            <div>
              <p className="mh-story-text">
                취업 준비는 이력서를 쓰는 일만으로 끝나지 않습니다. 공고를 읽고, 내 경험을 기준에 맞춰 정리하고,
                서류와 면접에서 어떻게 설명할지 준비해야 합니다. My ATS는 그 과정을 하나씩 이어볼 수 있도록 만들었습니다.
              </p>
              <p className="mh-story-text">
                AI가 대신 결정하는 것이 아니라, 내 경력과 지원 회사에 대해 더 구체적으로 생각할 수 있도록 분석과 질문,
                피드백을 제공합니다.
              </p>
              <div className="mh-quote">
                내 경험을 더 잘 이해하고, 다음 지원을 더 분명하게 준비하도록.
                <span className="mh-story-note">My ATS가 돕고자 하는 취업 준비의 방식입니다.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mh-capabilities" id="features">
          <div className="mh-wrap">
            <div className="mh-cap-head">
              <div>
                <div className="mh-section-kicker">WHAT YOU CAN DO</div>
                <h2>준비할 것을 찾고,<br />하나씩 연습합니다.</h2>
              </div>
              <p className="mh-cap-intro">이력서 분석부터 면접 답변 피드백까지, 실제 지원 과정에 맞춘 기능을 살펴보세요.</p>
            </div>
            <div className="mh-cap-list">
              {capabilities.map(({ number, icon: Icon, eyebrow, title, description, tags }) => (
                <article className="mh-cap-row" key={number}>
                  <span className="mh-cap-no">{number}</span>
                  <span className="mh-cap-icon"><Icon size={20} strokeWidth={1.7} /></span>
                  <div className="mh-cap-content">
                    <div className="mh-section-kicker">{eyebrow}</div>
                    <h3 className="mh-cap-title">{title}</h3>
                  </div>
                  <div className="mh-cap-copy">
                    {description}
                    <div className="mh-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mh-tools" id="how">
          <div className="mh-wrap mh-tools-grid">
            <div className="mh-tool-copy">
              <div className="mh-section-kicker">BEYOND THE RESUME</div>
              <h2>내 이야기를 정리하는<br />방식도 다양하게.</h2>
              <p>경력의 방향을 살피고, 말로 경험을 풀어내고, 연구 성과를 면접에서 설명할 준비까지 이어집니다.</p>
              <div className="mh-tool-list">
                <div className="mh-tool-item"><span><Check size={13} /></span><div><strong>커리어 분석</strong> — 추천 직무와 NCS 수준, 직무별 가이드 연봉을 확인합니다.</div></div>
                <div className="mh-tool-item"><span><Check size={13} /></span><div><strong>음성 자기소개서</strong> — 안내 질문에 답하거나 직접 말한 내용을 글 초안으로 만듭니다.</div></div>
                <div className="mh-tool-item"><span><Check size={13} /></span><div><strong>논문 정보 확인</strong> — 제목·저자·학회/저널 정보를 확인하고 Abstract 기반 질문을 준비합니다.</div></div>
              </div>
            </div>
            <div className="mh-research-card">
              <div className="mh-research-top"><span>RESEARCH EXPERIENCE</span><BookOpenCheck size={17} /></div>
              <div className="mh-research-title">연구 경험을<br />면접에서 설명할 준비</div>
              <div className="mh-research-meta">논문 메타데이터 확인 · 초록 기반 질문 생성<br />내 연구 내용에서 시작하는 면접 연습</div>
              <div className="mh-research-divider" />
              <div className="mh-research-question"><ChevronDown size={15} /> 연구의 핵심 질문과 결과를 설명해 주세요.</div>
            </div>
          </div>
        </section>

        <section className="mh-voice">
          <div className="mh-wrap">
            <div className="mh-voice-panel">
              <div>
                <div className="mh-voice-label">SPEAK YOUR STORY</div>
                <h3>먼저 말해보고, 글로 다듬어도 괜찮아요.</h3>
                <p>음성 가이드 질문에 답하거나 녹음 파일을 올리면, AI가 내용을 글로 옮겨 자기소개서 초안을 돕습니다.</p>
              </div>
              <div className="mh-voice-art" aria-hidden="true">
                <Mic2 size={20} />
                {[0,1,2,3,4,5,6,7,8].map((bar) => <span key={bar} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="mh-close">
          <div className="mh-wrap mh-close-inner">
            <div>
              <div className="mh-section-kicker">YOUR NEXT APPLICATION</div>
              <h2>다음 지원을 준비할 때,<br />내 경험부터 차근차근 살펴보세요.</h2>
              <p>My ATS에서 이력서와 채용 공고를 연결해 시작할 수 있습니다.</p>
            </div>
            <div className="mh-close-actions">
              <a className="mh-primary" href="/register">My ATS 시작하기 <ArrowRight size={16} /></a>
              <a className="mh-secondary" href="/login">로그인 <ArrowUpRight size={14} /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mh-footer">
        <div className="mh-wrap mh-footer-inner">
          <div>
            <Brand />
            <div className="mh-footer-note">이력서와 채용 공고를 연결하는 AI 취업 준비 도구</div>
          </div>
          <nav className="mh-footer-nav" aria-label="하단 메뉴">
            <a href="#why">서비스 이야기</a>
            <a href="#features">기능</a>
            <a href="/login">로그인</a>
            <a href="/register">시작하기</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
