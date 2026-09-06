import { Link } from "wouter"
import { ChevronRight, CheckCircle2, Building2, Code, ArrowRight, Shield, Zap, BarChart3, Mic, BriefcaseBusiness, BookOpenCheck } from "lucide-react"

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
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />채용 공고 URL 자동 수집</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />이력서 자동 커리어 분석</span>
              <span className="w-px h-4 bg-slate-700 hidden sm:block" />
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-blue-400" />이중 AI 서류 심사</span>
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
                title: "지원 공고 자동 수집",
                desc: "채용 공고 URL만 입력하세요. 텍스트는 물론 이미지 공고(OCR)까지 분석하여 맞춤 기준을 세웁니다.",
              },
              {
                step: "02",
                icon: <Zap className="w-7 h-7 text-blue-600" />,
                title: "이력서 분석 및 교정",
                desc: "PDF 스캔본도 완벽히 인식하며, 등록 즉시 내 이력서의 강점, 추천 직업, 가이드 연봉, 오탈자를 점검합니다.",
              },
              {
                step: "03",
                icon: <BarChart3 className="w-7 h-7 text-blue-600" />,
                title: "이중 AI 심사 및 다운로드",
                desc: "인성·역량 평가관의 이중 심사와 복수 AI 의견을 확인하고, 완성된 이력서를 3종의 PDF 템플릿으로 다운로드하세요.",
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
                  title: "AI 커리어 종합 분석",
                  desc: "이력서 등록 시 강점, NCS 직업군, 미래 전망, 가이드 연봉, 오탈자 및 날짜 표기를 자동으로 점검하고 요약합니다.",
                },
                {
                  icon: <CheckCircle2 className="w-6 h-6 text-blue-600" />,
                  title: "공고 URL 및 OCR 수집",
                  desc: "채용 공고 링크만 넣으면 텍스트는 물론 이미지 공고까지 OCR 기술로 추출해 맞춤 심사 기준을 세웁니다.",
                },
                {
                  icon: <Building2 className="w-6 h-6 text-blue-600" />,
                  title: "이중 AI 및 복수 심사",
                  desc: "인성 평가관과 역량 평가관 2개의 역할이 교차 검증하며, 유료 플랜에서는 다각도의 복수 AI 의견을 제공합니다.",
                },
                {
                  icon: <Code className="w-6 h-6 text-blue-600" />,
                  title: "PDF 다운로드 (3종)",
                  desc: "분석과 교정이 끝난 이력서를 깔끔한 3가지 디자인 템플릿의 PDF로 즉시 다운로드하여 지원에 활용하세요.",
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

        {/* ── Latest improvements ── */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <div className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 mb-4">
              새로워진 기능
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">취업 준비가 더 구체적이고 간편해졌습니다</h2>
            <p className="text-slate-500 mt-4 max-w-2xl mx-auto leading-relaxed">
              말로 경험을 정리하고, 직무 기준과 연구 성과까지 한 번에 점검하세요.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Mic className="w-7 h-7 text-blue-600" />,
                title: "말하면 완성되는 자기소개서",
                desc: "직접 녹음하거나 오디오 파일을 올리면 AI가 음성을 글로 바꾸고 자기소개서를 작성합니다. 완성된 글은 원하는 내 이력서에 바로 반영할 수 있습니다.",
              },
              {
                icon: <BriefcaseBusiness className="w-7 h-7 text-violet-600" />,
                title: "직무별 연봉과 NCS 수준",
                desc: "추천 직업마다 가이드 연봉을 확인하고, 내 경력과 역량이 NCS 1~8수준 중 어디에 해당하는지 구체적으로 파악할 수 있습니다.",
              },
              {
                icon: <BookOpenCheck className="w-7 h-7 text-emerald-600" />,
                title: "논문 검증과 맞춤 면접 질문",
                desc: "논문 제목·저자순·학회 및 저널 정보를 국내외 공식 기록과 대조하고, 실제 Abstract 내용을 바탕으로 연구 경험 면접 질문도 준비합니다.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg transition-all">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
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
                {["월 1회 AI 서류 심사", "인성·역량 이중 심사", "직무 유사도 검토"].map((f) => (
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
                {["월 5회 AI 서류 심사", "복수 AI 심사 의견", "직무 유사도 검토", "GitHub/포트폴리오 분석", "면접 시뮬레이션"].map((f) => (
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
                {["월 20회 AI 서류 심사", "복수 AI 심사 의견", "직무 유사도 검토", "무제한 면접 시뮬레이션", "우선 지원 처리"].map((f) => (
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
