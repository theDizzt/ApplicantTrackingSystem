import { useParams, Link } from "wouter"
import { useGetAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, CheckCircle2, XCircle, AlertTriangle, Link2, ExternalLink, TrendingUp } from "lucide-react"

// ── 타입 정의 ──────────────────────────────────────────────────────────────
interface UrlCheckResult {
  url: string
  type: "github" | "portfolio" | "other"
  accessible: boolean
  statusCode?: number
  githubData?: {
    login: string; name: string | null; bio: string | null
    publicRepos: number; followers: number; following: number
    topLanguages: string[]
    pinnedRepos?: Array<{ name: string; description: string | null; language: string | null; stars: number }>
    totalStars: number; accountAge: string
  }
  technicalAnalysis?: string
  error?: string
}

interface TechSkill { name: string; score: number }
interface PersonalityDimension { name: string; score: number }
interface RichAnalysis {
  technicalSkills: TechSkill[]
  personalityAnalysis: {
    score: number
    dimensions: PersonalityDimension[]
    strengths: string
    concerns: string
    summary: string
  }
  organizationalFit: { score: number; reasoning: string }
  urlAiEvaluation: string
}

// ── 공통 컴포넌트 ───────────────────────────────────────────────────────────
function ScoreCircle({ score, label, color }: { score: number | null | undefined; label: string; color: string }) {
  const v = score ?? 0
  const r = 45
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * v) / 100
  return (
    <div className="flex flex-col items-center gap-2 py-5 px-3">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8"
            className={color}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-black font-mono tracking-tight">{v}</span>
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
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function barColor(score: number) {
  if (score >= 70) return "bg-emerald-500"
  if (score >= 50) return "bg-amber-400"
  return "bg-red-500"
}

// ── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function AnalysisDetail() {
  const params = useParams()
  const analysisId = parseInt(params.id!, 10)
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
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  const isProcessing = analysis.status === "pending" || analysis.status === "processing"

  // rich 데이터 파싱
  let rich: RichAnalysis | null = null
  if (analysis.richAnalysisResult) {
    try { rich = JSON.parse(analysis.richAnalysisResult) } catch { /* ignore */ }
  }

  // URL 데이터 파싱
  let urlResults: UrlCheckResult[] = []
  if (analysis.urlAnalysisResult) {
    try { urlResults = JSON.parse(analysis.urlAnalysisResult) } catch { /* ignore */ }
  }

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
          </div>
          <p className="text-sm text-slate-500 mt-0.5 truncate">
            {analysis.resumeTitle} · {analysis.companyName}
          </p>
        </div>
        {!isProcessing && analysis.overallScore != null && (
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400 font-medium">종합 점수</div>
            <div className="text-4xl font-black font-mono tracking-tighter leading-none mt-0.5">
              {analysis.overallScore}
              <span className="text-base font-normal text-slate-400">/100</span>
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
              기술 역량·인성·직무 적합도를 병렬로 심사합니다. 약 30~60초 소요됩니다.
            </p>
          </CardContent>
        </Card>
      )}

      {!isProcessing && (
        <>
          {/* ── 4대 점수 ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { score: analysis.languageScore,  label: "국어 품질" },
              { score: analysis.jobMatchScore,   label: "직무 적합도" },
              { score: analysis.aiWritingScore,  label: "진정성 (AI 탐지)" },
              { score: rich?.personalityAnalysis?.score ?? null, label: "인성 점수" },
            ].map(({ score, label }) => (
              <Card key={label} className="rounded-2xl border border-slate-100 shadow-sm">
                <ScoreCircle score={score} label={label} color={scoreColor(score)} />
              </Card>
            ))}
          </div>

          {/* ── 기술별 점수 ── */}
          {rich?.technicalSkills && rich.technicalSkills.length > 0 && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  기술별 점수
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-2.5">
                {rich.technicalSkills
                  .sort((a, b) => b.score - a.score)
                  .map((sk) => (
                    <div key={sk.name} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-sm font-medium text-slate-700 truncate">{sk.name}</span>
                      <HBar score={sk.score} color={barColor(sk.score)} />
                      <span className="w-8 text-right text-sm font-bold font-mono text-slate-700">{sk.score}</span>
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
                {/* 세부 차원 바 */}
                <div className="space-y-2.5">
                  {rich.personalityAnalysis.dimensions.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{d.name}</span>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex-1">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-700"
                          style={{ width: `${d.score}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-bold font-mono text-slate-700">{d.score}</span>
                    </div>
                  ))}
                </div>
                {/* 강점 / 확인 필요 */}
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

          {/* ── 온라인 기술 역량 확인 ── */}
          {urlResults.length > 0 && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-blue-600" />
                  온라인 기술 역량 확인 (GitHub·URL)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5 space-y-3">
                {urlResults.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 flex-wrap">
                    {/* 타입 배지 */}
                    <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                      r.type === "github" ? "bg-slate-900 text-white" : "bg-blue-100 text-blue-700"
                    }`}>
                      {r.type === "github" ? "GitHub" : "URL"}
                    </span>
                    {/* URL 링크 */}
                    <a href={r.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline break-all">
                      {r.url}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                    </a>
                    {/* 상태 */}
                    {r.accessible ? (
                      <span className="shrink-0 text-xs text-slate-500">
                        {r.type === "github" ? `${r.githubData?.topLanguages?.[0] ?? ""} · ★${r.githubData?.totalStars ?? 0}` : "웹 페이지"}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-red-500">
                        확인 실패 {r.error ? `(${r.error})` : r.statusCode ? `(HTTP ${r.statusCode})` : ""}
                      </span>
                    )}
                  </div>
                ))}

                {/* GitHub 상세 */}
                {urlResults.filter(r => r.type === "github" && r.githubData).map((r, i) => (
                  <div key={`gh-${i}`} className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                    <div className="flex items-center gap-2">
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
                    {r.githubData!.pinnedRepos && r.githubData!.pinnedRepos.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {r.githubData!.pinnedRepos.map(repo => (
                          <div key={repo.name} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="font-mono font-semibold">{repo.name}</span>
                            {repo.language && <span className="text-slate-400">({repo.language})</span>}
                            {repo.stars > 0 && <span>★{repo.stars}</span>}
                            {repo.description && <span className="text-slate-400 truncate">— {repo.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* AI 종합 평가 */}
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
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all duration-700"
                      style={{ width: `${rich.organizationalFit.score}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{rich.organizationalFit.reasoning}</p>
              </CardContent>
            </Card>
          )}

          {/* ── 세부 피드백 ── */}
          <div className="grid md:grid-cols-2 gap-4">
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
          </div>

          {/* ── 핵심 개선사항 ── */}
          {analysis.improvementSuggestions && (
            <Card className="rounded-2xl border border-slate-100 shadow-sm">
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  핵심 개선사항
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-5">
                <ul className="space-y-3">
                  {analysis.improvementSuggestions
                    .split("\n")
                    .filter((s) => s.trim().length > 0)
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
