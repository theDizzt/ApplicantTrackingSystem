import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Compass, Loader2, AlertTriangle, Sparkles, Award, TrendingUp,
  Banknote, SpellCheck, CheckCircle2, RefreshCw
} from "lucide-react"

// ── 커리어 분석 타입 ────────────────────────────────────────────────────────
interface CareerStrength { title: string; evidence: string }
interface CareerNcsCategory { major: string; middle: string; level?: number; fitReason: string }
interface CareerSalaryGuide { min: number; max: number; basis: string }
interface CareerRecommendedJob {
  job: string
  ncsCategory: string
  fitScore: number
  reason: string
  outlook: string
  outlookScore: number
  salaryGuide?: CareerSalaryGuide
}
interface CareerPaper {
  title: string
  authors: string[]
  applicantAuthorOrder: number
  venue: string
  abstract: string
  issues: string[]
  verification?: { status: "verified" | "unverified"; source: string; title: string; authors: string[]; venue: string; doi: string }
}
interface CareerTypoIssue { found: string; suggestion: string; note: string }
interface CareerDateIssue { found: string; issue: string; suggestion: string }
export interface CareerAnalysisResult {
  strengths: CareerStrength[]
  ncsCategories: CareerNcsCategory[]
  recommendedJobs: CareerRecommendedJob[]
  summary: string
  resumeSummary?: string
  salaryGuide?: CareerSalaryGuide
  typoIssues?: CareerTypoIssue[]
  dateIssues?: CareerDateIssue[]
  papers?: CareerPaper[]
}
export interface CareerAnalysisState {
  inProgress: boolean
  error: string | null
  analyzedAt: string | null
  result: CareerAnalysisResult | null
}

interface Props {
  resumeId: number
}

const outlookBadge = (score: number) => {
  if (score >= 70) return { label: "전망 밝음", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  if (score >= 40) return { label: "보통", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  return { label: "주의", cls: "bg-red-100 text-red-700 border-red-200" }
}

export function CareerAnalysisPanel({ resumeId }: Props) {
  const [career, setCareer] = useState<CareerAnalysisState | null>(null)
  const [careerLoading, setCareerLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const careerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const careerLoadedRef = useRef<number | null>(null)

  // ── 커리어 분석: 상태 조회 & 폴링 ──────────────────────────────────────────
  type FetchOutcome =
    | { kind: "ok"; data: CareerAnalysisState }
    | { kind: "fatal" }
    | { kind: "transient" }

  const fetchCareer = async (): Promise<FetchOutcome> => {
    if (!resumeId) return { kind: "fatal" }
    try {
      const res = await fetch(`/api/resumes/${resumeId}/career-analysis`, {
        credentials: "include",
      })
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return { kind: "fatal" }
      }
      if (!res.ok) return { kind: "transient" }
      const data: CareerAnalysisState = await res.json()
      setCareer(data)
      return { kind: "ok", data }
    } catch {
      return { kind: "transient" }
    }
  }

  const stopCareerPoll = () => {
    if (careerPollRef.current) {
      clearInterval(careerPollRef.current)
      careerPollRef.current = null
    }
  }

  const MAX_POLL_FAILURES = 5
  const failPollAndStop = () => {
    stopCareerPoll()
    const msg = "커리어 분석 상태를 확인할 수 없습니다. 다시 시도해주세요."
    setCareer((prev) => ({
      inProgress: false,
      error: msg,
      analyzedAt: prev?.analyzedAt ?? null,
      result: prev?.result ?? null,
    }))
    toast.error(msg)
  }

  const startCareerPoll = () => {
    stopCareerPoll()
    let failures = 0
    careerPollRef.current = setInterval(async () => {
      const outcome = await fetchCareer()
      if (outcome.kind === "fatal") {
        failPollAndStop()
        return
      }
      if (outcome.kind === "transient") {
        failures += 1
        if (failures >= MAX_POLL_FAILURES) failPollAndStop()
        return
      }
      // ok
      failures = 0
      if (!outcome.data.inProgress) {
        stopCareerPoll()
        if (outcome.data.error) toast.error(outcome.data.error)
      }
    }, 2000)
  }

  useEffect(() => {
    if (!resumeId) {
      setCareer(null)
      stopCareerPoll()
      return
    }
    
    // 이력서 ID가 변경되면 상태 초기화 및 새로고침
    if (careerLoadedRef.current !== resumeId) {
      careerLoadedRef.current = resumeId
      setCareer(null)
      
      void (async () => {
        const outcome = await fetchCareer()
        if (outcome.kind === "ok" && outcome.data.inProgress) startCareerPoll()
      })()
    }
    return () => stopCareerPoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId])

  const startCareerAnalysis = async () => {
    if (!resumeId) return
    setCareerLoading(true)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/career-analysis`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "커리어 분석 시작에 실패했습니다")
      }
      setCareer((prev) => ({
        inProgress: true,
        error: null,
        analyzedAt: prev?.analyzedAt ?? null,
        result: prev?.result ?? null,
      }))
      startCareerPoll()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "커리어 분석 시작에 실패했습니다")
    } finally {
      setCareerLoading(false)
    }
  }

  if (!resumeId) return null

  const result = career?.result ?? null
  const inProgress = career?.inProgress ?? false

  return (
    <Card className="border-slate-200 h-full flex flex-col max-h-[850px] overflow-y-auto sticky top-6 custom-scrollbar">
      <CardHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 border-b pb-4">
        <CardTitle className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-600" />
          커리어 분석
          {career?.analyzedAt && (
            <span className="ml-auto text-xs font-normal text-slate-400">
              분석일: {new Date(career.analyzedAt).toLocaleString("ko-KR")}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {inProgress ? (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-8 flex flex-col items-center justify-center gap-4 text-sm text-indigo-700 h-64">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="font-medium">AI가 이력서를 분석하고 있습니다...</span>
            <span className="text-xs opacity-80">이 작업은 약 1~2분 정도 소요됩니다.</span>
          </div>
        ) : !result ? (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">AI 커리어 분석을 시작해보세요</h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-[280px]">
                이력서 내용만으로 당신의 강점과 NCS 기반 추천 직업, 미래 전망을 정밀하게 분석합니다.
              </p>
            </div>
            {career?.error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600 flex items-start gap-2 mx-auto mt-6">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{career.error}</span>
              </div>
            )}
            <div className="flex justify-center mt-8">
              <Button onClick={startCareerAnalysis} disabled={careerLoading} className="gap-2 w-full max-w-[280px]">
                {careerLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />분석 준비 중…</>
                  : <><Sparkles className="w-4 h-4" />커리어 분석 시작하기</>}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {result.resumeSummary && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-2">
                  <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2"><Sparkles className="w-4 h-4" />AI 요약</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{result.resumeSummary}</p>
                </div>
              )}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700">추천 직업</h3>
                <div className="flex flex-wrap gap-2">
                  {result.recommendedJobs.slice(0, 3).map((job, i) => <Badge key={i} variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">{job.job} · {job.fitScore}</Badge>)}
                </div>
              </div>
              {result.salaryGuide && (result.salaryGuide.min > 0 || result.salaryGuide.max > 0) && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-emerald-700 flex items-center gap-2"><Banknote className="w-4 h-4" />가이드 연봉</span>
                  <span className="text-sm font-extrabold text-emerald-700">연 {result.salaryGuide.min.toLocaleString()}~{result.salaryGuide.max.toLocaleString()}만원</span>
                </div>
              )}
              {(() => { const issueCount = (result.typoIssues?.length ?? 0) + (result.dateIssues?.length ?? 0); return <div className={`rounded-lg border px-3.5 py-3 flex items-center gap-2 text-sm font-medium ${issueCount ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}><SpellCheck className="w-4 h-4" />표기 점검: {issueCount ? `문제 ${issueCount}건` : "문제 없음"}</div> })()}
              <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <Button variant="outline" onClick={() => setShowDetails(true)} className="w-full gap-2">세부 분석 보기 <Compass className="w-4 h-4" /></Button>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><Compass className="w-5 h-5 text-indigo-600" />세부 커리어 분석</DialogTitle><DialogDescription>이력서에서 발견한 근거와 분석 결과를 자세히 확인하세요.</DialogDescription></DialogHeader>
                  <div className="space-y-8 pt-2">
            {/* 강점 */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Award className="w-4 h-4 text-amber-500" />발견된 강점
              </h3>
              <ul className="space-y-3">
                {result.strengths.map((s, i) => (
                  <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3.5">
                    <div className="font-bold text-slate-800 text-sm">{s.title}</div>
                    <div className="text-sm text-slate-500 mt-1.5 leading-relaxed">{s.evidence}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* NCS 직업군 */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Compass className="w-4 h-4 text-indigo-500" />NCS 적합 직무
              </h3>
              <div className="grid gap-3">
                {result.ncsCategories.map((c, i) => (
                  <div key={i} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge className="bg-indigo-600 hover:bg-indigo-600 text-xs py-0.5">{c.major}</Badge>
                      {c.middle && (
                        <Badge variant="outline" className="text-xs py-0.5 border-indigo-200 text-indigo-700 bg-white">
                          {c.middle}
                        </Badge>
                      )}
                      {c.level && <Badge variant="outline" className="text-xs py-0.5 border-violet-200 text-violet-700 bg-white">NCS {c.level}수준</Badge>}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{c.fitReason}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 추천 직업 */}
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <TrendingUp className="w-4 h-4 text-emerald-500" />추천 직업
              </h3>
              <div className="grid gap-4">
                {result.recommendedJobs.map((j, i) => {
                  const badge = outlookBadge(j.outlookScore)
                  return (
                    <div key={i} className="rounded-xl border border-slate-200 p-4 flex flex-col gap-3.5 bg-white">
                      <div>
                        <div className="font-bold text-slate-800">{j.job}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{j.ncsCategory}</div>
                      </div>

                      {/* 적합도 바 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>적합도</span>
                          <span className="font-bold text-slate-700">{j.fitScore}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${j.fitScore}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed">{j.reason}</p>
                      {j.salaryGuide && (j.salaryGuide.min > 0 || j.salaryGuide.max > 0) && (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                          <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5"><Banknote className="w-4 h-4" />가이드 연봉 · 연 {j.salaryGuide.min.toLocaleString()}~{j.salaryGuide.max.toLocaleString()}만원</div>
                          {j.salaryGuide.basis && <p className="mt-1 text-xs text-slate-500">{j.salaryGuide.basis}</p>}
                        </div>
                      )}

                      {/* 미래 전망 박스 */}
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3.5 space-y-2 mt-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />미래 전망
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${badge.cls} font-medium`}>
                            {badge.label} · {j.outlookScore}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{j.outlook}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 가이드 연봉 */}
            {result.salaryGuide && (result.salaryGuide.min > 0 || result.salaryGuide.max > 0) && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-2.5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <Banknote className="w-4 h-4" />가이드 연봉
                </h3>
                <div className="text-2xl font-extrabold text-emerald-700 tracking-tight">
                  연 {result.salaryGuide.min.toLocaleString()}만원 ~ {result.salaryGuide.max.toLocaleString()}만원
                </div>
                {result.salaryGuide.basis && (
                  <p className="text-sm text-slate-600 leading-relaxed">{result.salaryGuide.basis}</p>
                )}
              </div>
            )}

            {/* 표기 점검 (오탈자·날짜) */}
            {(result.papers?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 space-y-4">
                <h3 className="text-sm font-bold text-violet-800">논문 정보 점검</h3>
                {result.papers!.map((paper, i) => (
                  <div key={i} className="rounded-lg bg-white border border-violet-100 p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-bold text-slate-800">{paper.title}</div>
                      <Badge variant="outline" className={paper.verification?.status === "verified" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}>
                        {paper.verification?.status === "verified" ? "Crossref 확인" : "외부 확인 필요"}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">저자순: {paper.authors.join(", ") || "확인 필요"}{paper.applicantAuthorOrder > 0 ? ` · 지원자 ${paper.applicantAuthorOrder}저자` : ""}</div>
                    <div className="text-xs text-slate-600">제출·게재 학회/저널: {paper.venue || "확인 필요"}</div>
                    {paper.verification?.status === "verified" && (
                      <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2.5 text-xs text-emerald-800 space-y-1">
                        <div>확인 제목: {paper.verification.title}</div>
                        <div>확인 저자순: {paper.verification.authors.join(", ") || "기록 없음"}</div>
                        <div>확인 학회/저널: {paper.verification.venue || "기록 없음"}</div>
                        {paper.verification.doi && <a className="underline" href={`https://doi.org/${paper.verification.doi}`} target="_blank" rel="noreferrer">DOI 원문 확인</a>}
                      </div>
                    )}
                    {paper.issues?.length > 0 && <ul className="text-xs text-amber-700 list-disc pl-4">{paper.issues.map((issue, j) => <li key={j}>{issue}</li>)}</ul>}
                  </div>
                ))}
              </div>
            )}

            {/* 표기 점검 (오탈자·날짜) */}
            <div className="rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <SpellCheck className="w-4 h-4 text-amber-500" />표기 점검
              </h3>
              {(result.typoIssues?.length ?? 0) === 0 && (result.dateIssues?.length ?? 0) === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  표기 문제가 발견되지 않았습니다.
                </div>
              ) : (
                <div className="space-y-5">
                  {(result.typoIssues?.length ?? 0) > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-500">용어 오탈자</div>
                      <ul className="space-y-2">
                        {result.typoIssues!.map((t, i) => (
                          <li key={i} className="rounded-lg border border-amber-100 bg-amber-50/60 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-red-600 line-through break-words">{t.found}</span>
                              <span className="text-slate-400">→</span>
                              <span className="text-emerald-700 font-bold break-words">{t.suggestion}</span>
                            </div>
                            {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(result.dateIssues?.length ?? 0) > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-500">날짜·기간 표기</div>
                      <ul className="space-y-2">
                        {result.dateIssues!.map((d, i) => (
                          <li key={i} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 space-y-1.5">
                            <div className="flex items-start gap-2 text-sm text-amber-800">
                              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                              <span className="font-bold break-words">{d.found}</span>
                            </div>
                            {d.issue && <p className="text-xs text-slate-600">{d.issue}</p>}
                            {d.suggestion && (
                              <p className="text-xs text-emerald-700 font-medium">제안: {d.suggestion}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 종합 조언 */}
            {result.summary && (
              <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-5 space-y-2.5">
                <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  종합 조언
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
              </div>
            )}

            <Button
              variant="outline"
              onClick={startCareerAnalysis}
              disabled={careerLoading}
              className="w-full gap-2 mt-4"
            >
              {careerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              다시 분석하기
            </Button>

                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
