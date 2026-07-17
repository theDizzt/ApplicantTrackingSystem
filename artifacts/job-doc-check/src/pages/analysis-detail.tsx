import { useParams, Link } from "wouter"
import { useGetAnalysis, getGetAnalysisQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, CheckCircle2, XCircle, AlertTriangle, Link2 } from "lucide-react"

interface UrlCheckResult {
  url: string; type: "github" | "portfolio" | "other"; accessible: boolean; statusCode?: number;
  githubData?: { login: string; name: string|null; bio: string|null; publicRepos: number; followers: number; following: number; topLanguages: string[]; pinnedRepos?: Array<{name:string;description:string|null;language:string|null;stars:number}>; totalStars: number; accountAge: string; };
  technicalAnalysis?: string;
}

function ScoreCircle({ score, label, colorClass }: { score: number | null | undefined, label: string, colorClass: string }) {
  const displayScore = score ?? 0
  const dashArray = 283
  const dashOffset = dashArray - (dashArray * displayScore) / 100

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
          <circle 
            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
            className={`transition-all duration-1000 ease-out ${colorClass}`}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold font-mono">{displayScore}</span>
        </div>
      </div>
      <span className="mt-3 text-sm font-medium text-center">{label}</span>
    </div>
  )
}

function getScoreColor(score: number | null | undefined) {
  if (!score) return "text-muted-foreground"
  if (score >= 70) return "text-success"
  if (score >= 40) return "text-warning"
  return "text-destructive"
}

export default function AnalysisDetail() {
  const params = useParams()
  const analysisId = parseInt(params.id!, 10)
  const { data: analysis, isLoading } = useGetAnalysis(analysisId, {
    query: { queryKey: getGetAnalysisQueryKey(analysisId), enabled: !!analysisId, refetchInterval: (query) => { const s = query?.state?.data?.status; return s === "processing" || s === "pending" ? 3000 : false } }
  })

  if (isLoading || !analysis) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const isProcessing = analysis.status === "pending" || analysis.status === "processing"

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link 
          href="/analyses" 
          className="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            심사 결과 보고서
            {analysis.overallResult === "pass" && <Badge variant="success" className="text-base px-3 py-1">합격</Badge>}
            {analysis.overallResult === "fail" && <Badge variant="destructive" className="text-base px-3 py-1">불합격</Badge>}
            {isProcessing && <Badge variant="secondary" className="text-base px-3 py-1 animate-pulse">분석 중</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">
            {analysis.resumeTitle} • {analysis.companyName}
          </p>
        </div>
        {!isProcessing && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">종합 점수</div>
            <div className="text-4xl font-bold font-mono tracking-tighter">
              {analysis.overallScore}<span className="text-xl text-muted-foreground font-sans">/100</span>
            </div>
          </div>
        )}
      </div>

      {isProcessing ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
            <h3 className="text-xl font-semibold">AI가 서류를 분석하고 있습니다</h3>
            <p className="text-muted-foreground max-w-md mt-2">
              다차원 분석이 진행 중입니다. 약 30초~1분 정도 소요됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <ScoreCircle score={analysis.languageScore} label="국어 품질" colorClass={getScoreColor(analysis.languageScore)} />
            </Card>
            <Card>
              <ScoreCircle score={analysis.jobMatchScore} label="직무 적합도" colorClass={getScoreColor(analysis.jobMatchScore)} />
            </Card>
            <Card>
              <ScoreCircle score={analysis.aiWritingScore} label="진정성 (AI 탐지)" colorClass={getScoreColor(analysis.aiWritingScore)} />
            </Card>
            <Card>
              <ScoreCircle score={analysis.physiognomyScore} label="전문 이미지" colorClass={getScoreColor(analysis.physiognomyScore)} />
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  핵심 개선사항
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {analysis.improvementSuggestions ? (
                  <ul className="space-y-4">
                    {analysis.improvementSuggestions.split('\n').filter(s => s.trim().length > 0).map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="mt-1 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                          {idx + 1}
                        </div>
                        <span className="leading-relaxed">{suggestion.replace(/^[-*•]\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">생성된 개선사항이 없습니다.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                <CardTitle>국어 및 설득력</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{analysis.languageFeedback}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                <CardTitle>채용공고 적합도</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{analysis.jobMatchFeedback}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                <CardTitle>진정성 점수</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{analysis.aiWritingFeedback}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                <CardTitle>전문 이미지 피드백</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{analysis.physiognomyFeedback}</p>
              </CardContent>
            </Card>
          </div>

          {(analysis as any).urlAnalysisResult && (() => {
            let urlResults: UrlCheckResult[] = []
            try { urlResults = JSON.parse((analysis as any).urlAnalysisResult) } catch { return null }
            if (!urlResults.length) return null
            return (
              <Card>
                <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b">
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-primary" />
                    링크 분석 결과
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {urlResults.map((r, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline break-all">
                          {r.url}
                        </a>
                        <Badge variant={r.accessible ? "success" : "destructive"} className="shrink-0">
                          {r.accessible ? "접근 가능" : "접근 불가"}
                        </Badge>
                      </div>
                      {r.githubData && (
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">@{r.githubData.login} · {r.githubData.accountAge}</div>
                          {r.githubData.bio && <p className="text-sm text-muted-foreground">{r.githubData.bio}</p>}
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>저장소 {r.githubData.publicRepos}개</span>
                            <span>팔로워 {r.githubData.followers}명</span>
                            <span>⭐ {r.githubData.totalStars}</span>
                          </div>
                          {r.githubData.topLanguages.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {r.githubData.topLanguages.map(lang => (
                                <span key={lang} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{lang}</span>
                              ))}
                            </div>
                          )}
                          {r.githubData.pinnedRepos && r.githubData.pinnedRepos.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주요 프로젝트</div>
                              {r.githubData.pinnedRepos.map(repo => (
                                <div key={repo.name} className="text-sm flex items-start gap-2">
                                  <span className="font-mono font-medium shrink-0">{repo.name}</span>
                                  {repo.language && <span className="text-muted-foreground text-xs">({repo.language})</span>}
                                  {repo.stars > 0 && <span className="text-xs text-muted-foreground">⭐{repo.stars}</span>}
                                  {repo.description && <span className="text-muted-foreground truncate">— {repo.description}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {!r.githubData && r.technicalAnalysis && (
                        <pre className="text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded whitespace-pre-wrap">{r.technicalAnalysis}</pre>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })()}
        </>
      )}
    </div>
  )
}
