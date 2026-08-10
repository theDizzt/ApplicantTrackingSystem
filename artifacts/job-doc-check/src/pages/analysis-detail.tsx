import { useParams, Link } from "wouter"
import { useGetAnalysis, getGetAnalysisQueryKey, useRetryAnalysis } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft, CheckCircle2, XCircle, AlertTriangle,
  Link2, ExternalLink, TrendingUp, Banknote, Award, GraduationCap, Heart, RotateCcw,
} from "lucide-react"

// ── 타입 ──────────────────────────────────────────────────────────────────
interface UrlCheckResult {
  url: string; type: "github" | "portfolio" | "other"
  accessible: boolean; statusCode?: number
  githubData?: {
    login: string; name: string | null; bio: string | null
    publicRepos: number; followers: number; following: number
    topLanguages: string[]
    pinnedRepos?: { name: string; description: string | null; language: string | null; stars: number }[]
    totalStars: number; accountAge: string
  }
  error?: string
}

interface TechSkill        { name: string; score: number }
interface PersonalityDim   { name: string; score: number }
interface SalaryField      { field: string; min: number; max: number }

interface TechTermIssue    { term: string; issue: string; suggestion: string }

interface RichAnalysis {
  documentChecks?: {
    photoMissing: boolean
    coverLetterLength: number
    coverLetterTooShort: boolean
  }
  technicalSkills: TechSkill[]
  techTermIssues?: TechTermIssue[]
  personalityAnalysis: {
    score: number; dimensions: PersonalityDim[]
    strengths: string; concerns: string; summary: string
  }
  organizationalFit: { score: number; reasoning: string }
  urlAiEvaluation: string
  salaryAnalysis?: {
    estimatedMin: number; estimatedMax: number
    byField: SalaryField[]
    desiredSalaryComment: string; basis: string
  }
  expectedRank?: {
    applicable: boolean; rank: string
    yearsOfExperience: number; reasoning: string
  }
  graduationGap?: {
    detected: boolean; graduationYear: number; gapYears: number
    isLongGap: boolean; copingStrategy: string; sampleQuestions: string[]
  }
  motivationMatch?: {
    score: number
    feedback: string
    highlights: string[]
    weaknesses: string[]
    hasCoverLetter: boolean
  }
}

// ── 공통 UI ───────────────────────────────────────────────────────────────
function ScoreCircle({ score, label, color }: { score: number | null | undefined; label: string; color: string }) {
  const v = score ?? 0
  const r = 45; const circ = 2 * Math.PI * r
  const offset = circ - (circ * v) / 100
  return (
    <div className="flex flex-col items-center gap-2 py-5 px-3">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8"
            className={color} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-out" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black font-mono">{v}</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-center text-slate-600 leading-tight">{label}</span>
    </div>
  )
}

function scoreColor(s: number | null | undefined) {
  if (!s) return "text-slate-300"
  if (s >= 70) return "text-emerald-500"
  if (s >= 50) return "text-amber-400"
  return "text-red-500"
}

function HBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex-1">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}
function barColor(s: number) {
  return s >= 70 ? "bg-emerald-500" : s >= 50 ? "bg-amber-400" : "bg-red-500"
}

function wan(n: number) { return `${n.toLocaleString()}만원` }

// ── 메인 ─────────────────────────────────────────────────────────────────
export default function AnalysisDetail() {
  const params = useParams()
  const analysisId = parseInt(params.id!, 10)
  const queryClient = useQueryClient()
  const retryAnalysis = useRetryAnalysis()
  const { data: analysis, isLoading } = useGetAnalysis(analysisId, {
    query: {
      queryKey: getGetAnalysisQueryKey(analysisId),
      enabled: !!analysisId,
      refetchInterval: (q) => {
        const s = q?.state?.data?.status
        return s === "processing" || s === "pending" ? 3000 : false
      },
    },
  })

  if (isLoading || !analysis) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
      </div>
    )
  }

  const isProcessing = analysis.status === "pending" || analysis.status === "processing"
  const isFailed = analysis.status === "failed"

  let rich: RichAnalysis | null = null
  if (analysis.richAnalysisResult) {
    try { rich = JSON.parse(analysis.richAnalysisResult) } catch { /* ignore */ }
  }
  let urlResults: UrlCheckResult[] = []
  if (analysis.urlAnalysisResult) {
    try { urlResults = JSON.parse(analysis.urlAnalysisResult) } catch { /* ignore */ }
  }

  const salary = rich?.salaryAnalysis
  const rank   = rich?.expectedRank
  const gap    = rich?.graduationGap

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── 헤더 ── */}
      <div className="flex items-start gap-4">
        <Link href="/analyses"
          className="mt-1 inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">심사 결과 보고서</h1>
            {analysis.overallResult === "pass" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-0.5 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />합격
              </span>
            )}
            {analysis.overallResult === "fail" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-0.5 text-sm font-bold text-red-600 ring-1 ring-red-200">
                <XCircle className="w-3.5 h-3.5" />불합격
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-sm font-semibold text-blue-600 ring-1 ring-blue-200 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-500" />분석 중
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-0.5 text-sm font-bold text-red-600 ring-1 ring-red-200">
                <XCircle className="w-3.5 h-3.5" />심사 실패
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">
            {analysis.resumeTitle} · {analysis.companyName}
          </p>
        </div>
        {!isProcessing && analysis.overallScore != null && (
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 font-medium">종합 점수</div>
            <div className="text-4xl font-black font-mono tracking-tighter leading-none mt-0.5">
              {analysis.overallScore}<span className="text-base font-normal text-slate-400">/100</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 분석 중 ── */}
      {isProcessing && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6" />
            <h3 className="text-xl font-bold">검증된 AI 3개가 서류를 분석하고 있습니다</h3>
            <p className="text-slate-500 max-w-sm mt-2 text-sm leading-relaxed">
              기술 역량·인성·직무 적합도·예상 연봉을 병렬 심사합니다. 약 30~60초 소요됩니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── 심사 실패 ── */}
      {isFailed && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <XCircle className="w-14 h-14 text-red-500 mb-6" />
            <h3 className="text-xl font-bold">AI 심사를 완료하지 못했습니다</h3>
            <p className="text-slate-500 max-w-md mt-2 text-sm leading-relaxed">
              {analysis.errorMessage || "AI 서버에 연결할 수 없어 심사가 중단되었습니다. 관리자에게 문의해주세요."}
            </p>
            <p className="text-slate-400 max-w-md mt-3 text-xs">
              문제가 해결되었다면 아래 버튼으로 같은 이력서·회사 조건으로 즉시 재심사할 수 있습니다.
            </p>
            <Button
              className="mt-6"
              disabled={retryAnalysis.isPending}
              onClick={() => {
                retryAnalysis.mutate(
                  { id: analysisId },
                  {
                    onSuccess: () => {
                      toast.success("심사를 다시 시작했습니다")
                      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) })
                    },
                    onError: (err) => {
                      const data = (err as { data?: { error?: string } | null })?.data
                      toast.error(data?.error || "재시도에 실패했습니다")
                    },
                  }
                )
              }}
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${retryAnalysis.isPending ? "animate-spin" : ""}`} />
              {retryAnalysis.isPending ? "재시도 중..." : "다시 시도"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isProcessing && !isFailed && (
        <>
          {/* ── 4대 점수 ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { score: analysis.languageScore,                   label: "국어 품질" },
              { score: analysis.jobMatchScore,                   label: "직무 적합도" },
              { score: analysis.aiWritingScore,                  label: "진정성 (AI 탐지)" },
              { score: rich?.personalityAnalysis?.score ?? null, label: "인성 점수" },
            ].map(({ score, label }) => (
              <Card key={label} className="rounded-2xl border border-slate-100 shadow-sm">
                <ScoreCircle score={score} label={label} color={scoreColor(score)} />
              </Card>
            ))}
          </div>

          {/* ── 서류 기본 점검 ── */}
          {rich?.documentChecks && (rich.documentChecks.photoMissing || rich.documentChecks.coverLetterTooShort) && (
            <Card className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />서류 기본 점검
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-2">
                {rich.documentChecks.photoMissing && (
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <XCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span><b>사진 미등록</b> — 이력서에 사진이 없습니다. 지원 기업에 따라 사진이 요구될 수 있으니 확인하세요.</span>
                  </div>
                )}
                {rich.documentChecks.coverLetterTooShort && (
                  <div className="flex items-start gap-2 text-sm text-slate-700">
                    <XCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <b>자기소개서 분량 부족</b> — 현재 공백 제외 {rich.documentChecks.coverLetterLength.toLocaleString()}자로 300자 미만입니다.
                      지원 동기와 핵심 경험을 구체적으로 보완하는 것을 권장합니다.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 예상 연봉 산정 ── */}
          {salary && (
            <Card className="rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/60 to-white">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-800">
                  <Banknote className="w-4 h-4" />
                  예상 연봉 산정 (2026 최저시급 기준)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-4">
                {/* 종합 예상 범위 */}
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-emerald-700 text-white px-5 py-3 text-center">
                    <div className="text-xs font-medium opacity-80 mb-0.5">예상 연봉 범위</div>
                    <div className="text-xl font-black tracking-tight">
                      {wan(salary.estimatedMin)} ~ {wan(salary.estimatedMax)}
                    </div>
                  </div>
                  {rank?.applicable && rank.rank && (
                    <div className="rounded-xl bg-blue-700 text-white px-5 py-3 text-center">
                      <div className="text-xs font-medium opacity-80 mb-0.5">예상 직급</div>
                      <div className="text-xl font-black tracking-tight">{rank.rank}</div>
                    </div>
                  )}
                </div>

                {/* 직군별 예상 연봉 */}
                {salary.byField.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">직군별 예상 연봉</p>
                    {salary.byField.map((f) => (
                      <div key={f.field} className="flex items-center gap-3">
                        <span className="w-36 shrink-0 text-sm font-medium text-slate-700 truncate">{f.field}</span>
                        <div className="h-2 rounded-full bg-emerald-100 overflow-hidden flex-1">
                          <div className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min((f.max / 12000) * 100, 100)}%`, transition: "width 0.7s" }} />
                        </div>
                        <span className="text-xs text-slate-500 shrink-0">{wan(f.min)} ~ {wan(f.max)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 희망 연봉 비교 */}
                {salary.desiredSalaryComment && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">희망 연봉 비교</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{salary.desiredSalaryComment}</p>
                  </div>
                )}

                {/* 산정 근거 */}
                {salary.basis && (
                  <p className="text-xs text-slate-400 leading-relaxed">{salary.basis}</p>
                )}

                {/* 직급 근거 */}
                {rank?.applicable && rank.reasoning && (
                  <p className="text-sm text-slate-600 leading-relaxed border-t border-emerald-100 pt-3">
                    <span className="font-semibold text-emerald-700">직급 산정 근거: </span>
                    {rank.reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 졸업 공백 대응 ── */}
          {gap?.isLongGap && (
            <Card className="rounded-2xl border border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/60 to-white">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-800">
                  <GraduationCap className="w-4 h-4" />
                  졸업 공백 면접 대응 방안
                  <span className="ml-auto text-xs font-normal bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5">
                    {gap.graduationYear}년 졸업 · {gap.gapYears}년 경과
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-4">
                {gap.copingStrategy && (
                  <div className="rounded-xl bg-white border border-amber-100 px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-2">면접 대응 전략</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{gap.copingStrategy}</p>
                  </div>
                )}
                {gap.sampleQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-amber-700 mb-2">예상 면접 질문 (반드시 준비)</p>
                    <ul className="space-y-2">
                      {gap.sampleQuestions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm text-slate-700 leading-relaxed">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 기술별 점수 ── */}
          {rich?.technicalSkills && rich.technicalSkills.length > 0 && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />기술별 점수
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-2.5">
                {rich.technicalSkills.sort((a, b) => b.score - a.score).map((sk) => (
                  <div key={sk.name} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm font-medium text-slate-700 truncate">{sk.name}</span>
                    <HBar score={sk.score} color={barColor(sk.score)} />
                    <span className="w-8 text-right text-sm font-bold font-mono text-slate-700">{sk.score}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── 기술 용어 검증 ── */}
          {rich?.techTermIssues && rich.techTermIssues.length > 0 && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />기술 용어 검증
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-3">
                {rich.techTermIssues.map((t, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-red-600 line-through">{t.term}</span>
                      {t.suggestion && (
                        <>
                          <span className="text-slate-400">→</span>
                          <span className="font-mono font-semibold text-emerald-700">{t.suggestion}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{t.issue}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── 인성 검사 ── */}
          {rich?.personalityAnalysis && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-purple-700">인성 검사 (자기소개서 기반)</CardTitle>
                <span className="text-lg font-black text-purple-700">{rich.personalityAnalysis.score}점</span>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-4">
                <div className="space-y-2.5">
                  {rich.personalityAnalysis.dimensions.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{d.name}</span>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex-1">
                        <div className="h-full rounded-full bg-purple-500 transition-all duration-700" style={{ width: `${d.score}%` }} />
                      </div>
                      <span className="w-8 text-right text-sm font-bold font-mono text-slate-700">{d.score}</span>
                    </div>
                  ))}
                </div>
                {rich.personalityAnalysis.strengths && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                    <p className="text-xs font-bold text-emerald-700 mb-1">강점</p>
                    <p className="text-sm text-emerald-800 leading-relaxed">{rich.personalityAnalysis.strengths}</p>
                  </div>
                )}
                {rich.personalityAnalysis.concerns && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">확인 필요</p>
                    <p className="text-sm text-amber-800 leading-relaxed">{rich.personalityAnalysis.concerns}</p>
                  </div>
                )}
                {rich.personalityAnalysis.summary && (
                  <p className="text-sm text-slate-600 leading-relaxed pt-1">{rich.personalityAnalysis.summary}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 온라인 기술 역량 ── */}
          {urlResults.length > 0 && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-600" />온라인 기술 역량 확인 (GitHub·URL)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-3">
                {urlResults.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 flex-wrap">
                    <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${r.type === "github" ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-700"}`}>
                      {r.type === "github" ? "GitHub" : "URL"}
                    </span>
                    <a href={r.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline break-all">
                      {r.url}<ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    </a>
                    {r.accessible
                      ? <span className="shrink-0 text-xs text-slate-500">{r.type === "github" ? `${r.githubData?.topLanguages?.[0] ?? ""} · ★${r.githubData?.totalStars ?? 0}` : "웹 페이지"}</span>
                      : <span className="shrink-0 text-xs font-semibold text-red-500">확인 실패 {r.error ? `(${r.error})` : r.statusCode ? `(HTTP ${r.statusCode})` : ""}</span>
                    }
                  </div>
                ))}
                {urlResults.filter(r => r.type === "github" && r.githubData).map((r, i) => (
                  <div key={`gh-${i}`} className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">@{r.githubData!.login}</span>
                      <span className="text-xs text-slate-400">· {r.githubData!.accountAge}</span>
                      <span className="text-xs text-slate-400">저장소 {r.githubData!.publicRepos}개</span>
                      <span className="text-xs text-slate-400">팔로워 {r.githubData!.followers}명</span>
                      <span className="text-xs text-slate-400">★{r.githubData!.totalStars}</span>
                    </div>
                    {r.githubData!.topLanguages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.githubData!.topLanguages.map(lang => (
                          <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{lang}</span>
                        ))}
                      </div>
                    )}
                    {r.githubData!.pinnedRepos?.map(repo => (
                      <div key={repo.name} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="font-mono font-semibold">{repo.name}</span>
                        {repo.language && <span className="text-slate-400">({repo.language})</span>}
                        {repo.stars > 0 && <span>★{repo.stars}</span>}
                        {repo.description && <span className="text-slate-400 truncate">— {repo.description}</span>}
                      </div>
                    ))}
                  </div>
                ))}
                {rich?.urlAiEvaluation && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 mt-1">
                    <p className="text-xs font-bold text-blue-700 mb-1">AI 평가</p>
                    <p className="text-sm text-blue-900 leading-relaxed">{rich.urlAiEvaluation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 조직 적합도 ── */}
          {rich?.organizationalFit && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-teal-700">조직 적합도 (프로젝트 이력·협업 흔적 기반)</CardTitle>
                <span className="text-lg font-black text-teal-700">{rich.organizationalFit.score}점</span>
              </CardHeader>
              <CardContent className="px-6 pb-5">
                <div className="mb-3">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-700"
                      style={{ width: `${rich.organizationalFit.score}%` }} />
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{rich.organizationalFit.reasoning}</p>
              </CardContent>
            </Card>
          )}

          {/* ── 세부 피드백 2×2 그리드 ── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* 국어 및 설득력 */}
            {analysis.languageFeedback && (
              <Card className="rounded-2xl border border-slate-100 shadow-sm">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-slate-700">국어 및 설득력</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{analysis.languageFeedback}</p>
                </CardContent>
              </Card>
            )}

            {/* 채용공고 적합도 */}
            {analysis.jobMatchFeedback && (
              <Card className="rounded-2xl border border-slate-100 shadow-sm">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-slate-700">채용공고 적합도</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{analysis.jobMatchFeedback}</p>
                </CardContent>
              </Card>
            )}

            {/* 진정성 (AI 탐지) */}
            {analysis.aiWritingFeedback && (
              <Card className="rounded-2xl border border-slate-100 shadow-sm">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-bold text-slate-700">진정성 (AI 탐지)</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{analysis.aiWritingFeedback}</p>
                </CardContent>
              </Card>
            )}

            {/* 지원 동기·입사 포부 매칭도 — 우측 하단 */}
            {rich?.motivationMatch && (
              <Card className="rounded-2xl border border-rose-100 shadow-sm bg-gradient-to-br from-rose-50/50 to-white">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                      지원 동기·입사 포부 매칭도
                    </CardTitle>
                    <span className={`text-base font-black font-mono ${
                      rich.motivationMatch.score >= 70 ? "text-emerald-600"
                        : rich.motivationMatch.score >= 50 ? "text-amber-500"
                        : "text-red-500"
                    }`}>
                      {rich.motivationMatch.score}점
                    </span>
                  </div>
                  {/* 점수 바 */}
                  <div className="mt-2 h-1.5 rounded-full bg-rose-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        rich.motivationMatch.score >= 70 ? "bg-emerald-500"
                          : rich.motivationMatch.score >= 50 ? "bg-amber-400"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${rich.motivationMatch.score}%` }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  {/* 자기소개서 없는 경우 안내 */}
                  {!rich.motivationMatch.hasCoverLetter ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-500 leading-relaxed">
                        자기소개서가 등록되지 않아 지원 동기 매칭 분석을 진행할 수 없습니다.
                        이력서에 자기소개서를 포함해 다시 심사하면 더 정밀한 분석을 받을 수 있습니다.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* 종합 피드백 */}
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {rich.motivationMatch.feedback}
                      </p>

                      {/* 잘 매칭된 부분 */}
                      {rich.motivationMatch.highlights.length > 0 && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 space-y-1.5">
                          <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />잘 매칭된 내용
                          </p>
                          <ul className="space-y-1">
                            {rich.motivationMatch.highlights.map((h, i) => (
                              <li key={i} className="text-xs text-emerald-800 leading-relaxed flex items-start gap-1.5">
                                <span className="shrink-0 mt-0.5 w-1 h-1 rounded-full bg-emerald-500 block" />
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 개선 필요 부분 */}
                      {rich.motivationMatch.weaknesses.length > 0 && (
                        <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 space-y-1.5">
                          <p className="text-xs font-bold text-amber-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />개선이 필요한 부분
                          </p>
                          <ul className="space-y-1">
                            {rich.motivationMatch.weaknesses.map((w, i) => (
                              <li key={i} className="text-xs text-amber-800 leading-relaxed flex items-start gap-1.5">
                                <span className="shrink-0 mt-0.5 w-1 h-1 rounded-full bg-amber-500 block" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 핵심 개선사항 ── */}
          {analysis.improvementSuggestions && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />핵심 개선사항
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5">
                <ul className="space-y-3">
                  {analysis.improvementSuggestions
                    .split("\n").filter(s => s.trim().length > 0)
                    .map((s, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold ring-1 ring-amber-100">
                          {idx + 1}
                        </div>
                        <span className="text-sm text-slate-700 leading-relaxed">{s.replace(/^[•\-*]\s*/, "")}</span>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
