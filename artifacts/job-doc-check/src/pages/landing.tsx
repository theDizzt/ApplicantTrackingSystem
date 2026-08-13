import { Link } from "wouter"
import { ChevronRight, CheckCircle2, Building2, Code, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="My ATS" className="h-9 w-auto" />
            <div className="leading-none">
              <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">My ATS</div>
              <div className="text-sm font-bold text-slate-800 tracking-tight hidden sm:block">Applicant Tracking System</div>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              로그인
            </Link>
            <Link href="/register" className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
              무료 시작
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 text-white">
          {/* decorative grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
          {/* glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-6 py-28 md:py-40 text-center">
            {/* pill badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300 mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              My ATS 공식 서비스
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.08]">
              합격을 만드는
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">
                My ATS
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-4 leading-relaxed">
              인사 담당자의 눈으로, AI의 정밀도로.
              <br className="hidden md:block" />
              이력서를 지원 회사에 맞게 정밀 분석해 합격 가능성을 높이세요.
            </p>

            {/* stats row */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-12">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />4가지 정밀 채점</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />GitHub 기술 스택 분석</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />AI 면접 질문 생성</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex h-13 items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all hover:-translate-y-0.5 w-full sm:w-auto"
              >
                무료로 심사 시작하기
                <ChevronRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-13 items-center justify-center rounded-xl border border-slate-600 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/10 transition-all w-full sm:w-auto"
              >
                로그인
              </Link>
            </div>
          </div>

          {/* wave divider */}
          <div className="relative h-16 overflow-hidden">
            <svg viewBox="0 0 1440 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 w-full" preserveAspectRatio="none">
              <path d="M0 64L1440 64L1440 0C1200 48 960 64 720 48C480 32 240 0 0 16L0 64Z" fill="white" />
            </svg>
          </div>
        </section>

        {/* ── Trust bar ── */}
        <section className="border-b border-slate-100 py-6">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { value: "4가지", label: "AI 분석 항목" },
                { value: "30초", label: "평균 분석 시간" },
                { value: "실시간", label: "GitHub 기술 분석" },
              ].map((s) => (
                <div key={s.label} className="text-center py-2">
                  <div className="text-2xl font-black text-blue-600">{s.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">서비스 흐름</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">3단계로 완성되는 합격 전략</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: <Building2 className="w-7 h-7 text-blue-600" />,
                title: "회사 정보 등록",
                desc: "지원 회사의 채용공고, 인재상, JD를 입력하세요. AI가 맞춤 기준을 설정합니다.",
              },
              {
                step: "02",
                icon: <Zap className="w-7 h-7 text-blue-600" />,
                title: "AI 서류 심사",
                desc: "이력서·자기소개서를 업로드하면 국어 품질, 직무 적합도, AI 작성 여부, GitHub 분석까지 자동으로 채점합니다.",
              },
              {
                step: "03",
                icon: <BarChart3 className="w-7 h-7 text-blue-600" />,
                title: "결과 확인 & 면접 준비",
                desc: "통과/불합격 판정과 함께 핵심 개선사항을 받고, AI 면접 질문으로 실전 연습까지 완성하세요.",
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-2xl border border-slate-100 bg-white p-8 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
                <div className="absolute top-6 right-6 text-5xl font-black text-slate-50 select-none leading-none group-hover:text-blue-50 transition-colors">
                  {item.step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="bg-slate-50 border-y border-slate-100 py-24">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">핵심 기능</p>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">인사 담당자의 관점, 그대로</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: <Shield className="w-6 h-6 text-blue-600" />,
                  title: "AI 작성 탐지",
                  desc: "ChatGPT 등으로 작성된 이력서를 판별합니다. 진정성 점수로 리스크를 사전 파악하세요.",
                },
                {
                  icon: <CheckCircle2 className="w-6 h-6 text-blue-600" />,
                  title: "국어 품질 채점",
                  desc: "문법, 맞춤법, 논리 흐름, 설득력을 정밀 평가합니다.",
                },
                {
                  icon: <Building2 className="w-6 h-6 text-blue-600" />,
                  title: "직무 적합도 분석",
                  desc: "JD와 인재상 기반으로 이력서 내용의 일치도를 수치화합니다.",
                },
                {
                  icon: <Code className="w-6 h-6 text-blue-600" />,
                  title: "GitHub 기술 분석",
                  desc: "이력서의 GitHub 링크를 실시간 접속 확인 후 언어, 프로젝트, 스타 수를 분석합니다.",
                },
              ].map((f) => (
                <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:border-blue-100 hover:shadow-md transition-all">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">요금제</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">지원 횟수에 맞게 선택하세요</h2>
            <p className="text-slate-500 mt-3">모든 플랜은 즉시 이용 가능하며, 언제든지 변경 또는 해지할 수 있습니다.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
            {/* Free */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <div className="mb-6">
                <h3 className="text-lg font-bold">무료</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-black">₩0</span>
                  <span className="text-slate-400 text-sm mb-1">/월</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">부담 없이 먼저 경험해보세요</p>
              </div>
              <ul className="space-y-3 text-sm mb-8">
                {["월 1회 AI 서류 심사", "기본 분석 리포트", "개선사항 제시"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block w-full text-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                무료로 시작
              </Link>
            </div>

            {/* Basic — featured */}
            <div className="relative rounded-2xl border-2 border-blue-600 bg-white p-8 shadow-xl shadow-blue-100">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow">
                가장 인기
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold">베이직</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-black text-blue-600">₩9,900</span>
                  <span className="text-slate-400 text-sm mb-1">/월</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">본격적인 취업 준비를 위해</p>
              </div>
              <ul className="space-y-3 text-sm mb-8">
                {["월 5회 AI 서류 심사", "4가지 항목 정밀 분석", "GitHub/포트폴리오 분석", "면접 시뮬레이션", "개선사항 상세 제시"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span className="text-slate-700 font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block w-full text-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm">
                베이직 시작하기
              </Link>
            </div>

            {/* Premium */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <div className="mb-6">
                <h3 className="text-lg font-bold">프리미엄</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-black">₩19,900</span>
                  <span className="text-slate-400 text-sm mb-1">/월</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">집중적인 취업 시즌에 적합</p>
              </div>
              <ul className="space-y-3 text-sm mb-8">
                {["월 20회 AI 서류 심사", "4가지 항목 정밀 분석", "GitHub/포트폴리오 분석", "무제한 면접 시뮬레이션", "우선 지원 처리"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600">{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className="block w-full text-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
                프리미엄 시작하기
              </Link>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-br from-slate-950 to-blue-950 text-white py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              지금 바로 서류를 점검해보세요
            </h2>
            <p className="text-slate-300 text-lg mb-10">
              무료 플랜으로 시작해 합격률이 얼마나 달라지는지 직접 확인하세요.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition-all hover:-translate-y-0.5"
            >
              무료로 시작하기 <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="My ATS" className="h-7 w-auto opacity-70" />
            <div className="leading-none">
              <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">My ATS</div>
              <div className="text-xs font-semibold text-slate-500">Applicant Tracking System</div>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} My ATS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
