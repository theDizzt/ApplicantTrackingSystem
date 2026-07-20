import { useMemo, useState } from "react"
import { useLocation } from "wouter"
import {
  useListResumes, useListCompanies, useCreateAnalysis, useListAnalyses,
} from "@workspace/api-client-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Building2, BrainCircuit, CheckCircle2, XCircle, RotateCcw } from "lucide-react"

export default function NewAnalysisPage() {
  const [, setLocation] = useLocation()
  const { data: resumes }   = useListResumes()
  const { data: companies } = useListCompanies()
  const { data: analyses }  = useListAnalyses()
  const createAnalysis = useCreateAnalysis()

  const [selectedResumeId,  setSelectedResumeId]  = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  // 회사별 심사 통계 계산: { [companyId]: { count, bestScore, bestResult } }
  const companyStats = useMemo(() => {
    const map: Record<number, { count: number; bestScore: number | null; bestResult: string | null }> = {}
    for (const a of analyses ?? []) {
      if (a.status !== "completed") continue
      const prev = map[a.companyId]
      const score = a.overallScore ?? null
      if (!prev) {
        map[a.companyId] = { count: 1, bestScore: score, bestResult: a.overallResult ?? null }
      } else {
        prev.count += 1
        if (score !== null && (prev.bestScore === null || score > prev.bestScore)) {
          prev.bestScore = score
          prev.bestResult = a.overallResult ?? null
        }
      }
    }
    return map
  }, [analyses])

  const handleSubmit = () => {
    if (!selectedResumeId || !selectedCompanyId) {
      toast.error("이력서와 회사를 모두 선택해주세요")
      return
    }
    createAnalysis.mutate(
      { data: { resumeId: selectedResumeId, companyId: selectedCompanyId } },
      {
        onSuccess: (data) => { toast.success("심사가 시작되었습니다"); setLocation(`/analyses/${data.id}`) },
        onError:   () => toast.error("심사 시작에 실패했습니다"),
      }
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI 서류 심사 시작</h1>
        <p className="text-muted-foreground mt-1">심사할 이력서와 지원 회사를 선택하세요.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* ── 이력서 선택 ── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            1. 이력서 선택
          </h2>
          <div className="space-y-3">
            {resumes?.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-slate-50">
                등록된 이력서가 없습니다. 먼저 이력서를 등록해주세요.
              </div>
            )}
            {resumes?.map(resume => (
              <div
                key={resume.id}
                onClick={() => setSelectedResumeId(resume.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selectedResumeId === resume.id
                    ? "border-primary ring-1 ring-primary bg-primary/5"
                    : "hover:border-slate-300 bg-card"
                }`}
              >
                <div className="font-medium">{resume.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 회사 선택 ── */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            2. 지원 회사 선택
          </h2>
          <div className="space-y-3">
            {companies?.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-slate-50">
                등록된 회사가 없습니다. 먼저 회사를 등록해주세요.
              </div>
            )}
            {companies?.map(company => {
              const stat = companyStats[company.id]
              const isSelected = selectedCompanyId === company.id
              const result = stat?.bestResult

              return (
                <div
                  key={company.id}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "hover:border-slate-300 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium leading-snug">{company.name}</span>

                    {stat && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 심사 횟수 */}
                        <Badge
                          variant="secondary"
                          className="gap-1 text-[10px] px-1.5 py-0 h-5 font-medium text-slate-500"
                          title={`${stat.count}회 심사`}
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          {stat.count}회
                        </Badge>

                        {/* 최고 점수 */}
                        {stat.bestScore !== null && (
                          <Badge
                            className={`gap-1 text-[11px] px-2 py-0 h-5 font-bold ${
                              result === "pass"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-red-100 text-red-600 hover:bg-red-100"
                            }`}
                          >
                            {result === "pass"
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <XCircle className="w-3 h-3" />
                            }
                            최고 {stat.bestScore}점
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 이미 심사한 회사 안내 문구 */}
                  {stat && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      이전 최고 점수 기준 ·{" "}
                      {result === "pass" ? "합격 수준" : "보완 후 재도전 권장"}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="pt-8 border-t flex justify-end">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!selectedResumeId || !selectedCompanyId || createAnalysis.isPending}
          className="w-full md:w-auto"
        >
          <BrainCircuit className="w-5 h-5 mr-2" />
          {createAnalysis.isPending ? "심사 시작 중..." : "AI 심사 시작"}
        </Button>
      </div>
    </div>
  )
}
