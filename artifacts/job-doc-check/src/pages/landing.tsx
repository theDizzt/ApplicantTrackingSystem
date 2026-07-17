import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "wouter"
import { BrainCircuit, ChevronRight, FileText, CheckCircle2, AlertCircle, Building2, Users, Code } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <BrainCircuit className="w-6 h-6" />
            AI 서류 심사관
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">로그인</Link>
            <Link href="/register" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              시작하기
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full py-24 md:py-32 bg-slate-50 dark:bg-slate-900 border-b">
          <div className="container mx-auto px-4 text-center">
            <Badge className="mb-4 text-sm font-medium" variant="secondary">취업 서류 심사의 기준</Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto">
              전문 AI 서류 심사
              <br/>
              <span className="text-primary">지원 전에 확인하세요.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              실제 인사 담당자 수준의 정밀도로 이력서를 분석합니다. 지원 회사 맞춤 심사로 합격 가능성을 높이세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 w-full sm:w-auto">
                무료 심사 시작하기 <ChevronRight className="ml-2 w-4 h-4" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground w-full sm:w-auto">
                로그인
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-24">
          <div className="grid md:grid-cols-4 gap-8">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">정밀 분석</CardTitle>
                <CardDescription className="text-base mt-2">
                  국어 품질, 직무 적합도, AI 작성 탐지 등 4가지 항목으로 정밀 채점합니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">맞춤형 기업 분석</CardTitle>
                <CardDescription className="text-base mt-2">
                  지원 회사의 인재상과 채용공고를 기준으로 서류를 엄밀하게 평가합니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">면접 시뮬레이션</CardTitle>
                <CardDescription className="text-base mt-2">
                  이력서의 취약점을 분석해 예상 면접 질문을 생성합니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">GitHub/포트폴리오 분석</CardTitle>
                <CardDescription className="text-base mt-2">
                  이력서의 GitHub·포트폴리오 링크를 실시간으로 접속 확인하고 기술 스택을 분석합니다.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Pricing */}
        <section className="w-full bg-slate-50 dark:bg-slate-900 border-t border-b py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">요금제</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl">무료</CardTitle>
                  <div className="text-3xl font-bold my-2">₩0<span className="text-sm font-normal text-muted-foreground">/월</span></div>
                  <CardDescription>월 1회 심사</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>월 1회 AI 서류 심사</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>기본 분석 리포트</span></li>
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Link href="/register" className="inline-flex w-full h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    시작하기
                  </Link>
                </div>
              </Card>
              <Card className="flex flex-col border-primary shadow-md ring-1 ring-primary">
                <CardHeader>
                  <CardTitle className="text-xl">베이직</CardTitle>
                  <div className="text-3xl font-bold my-2">₩9,900<span className="text-sm font-normal text-muted-foreground">/월</span></div>
                  <CardDescription>월 5회 심사</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>월 5회 AI 서류 심사</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>면접 시뮬레이션</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>GitHub 분석</span></li>
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Link href="/register" className="inline-flex w-full h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                    시작하기
                  </Link>
                </div>
              </Card>
              <Card className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl">프리미엄</CardTitle>
                  <div className="text-3xl font-bold my-2">₩19,900<span className="text-sm font-normal text-muted-foreground">/월</span></div>
                  <CardDescription>월 20회 심사</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>월 20회 AI 서류 심사</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>무제한 면접 시뮬레이션</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>GitHub/포트폴리오 분석</span></li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /><span>우선 지원</span></li>
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Link href="/register" className="inline-flex w-full h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                    시작하기
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} AI 서류 심사관. All rights reserved.</p>
      </footer>
    </div>
  )
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variant === 'secondary' ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-primary text-primary-foreground hover:bg-primary/80'} ${className}`}>
      {children}
    </span>
  )
}
