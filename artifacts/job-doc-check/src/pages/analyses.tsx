import { useListAnalyses, useRetryAnalysis, getListAnalysesQueryKey } from "@workspace/api-client-react"
import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BrainCircuit, Building2, ChevronRight, FileText, Plus, Clock, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useState } from "react"

export default function AnalysesPage() {
  const { data: analyses, isLoading } = useListAnalyses()
  const queryClient = useQueryClient()
  const retryAnalysis = useRetryAnalysis()
  const [retryingId, setRetryingId] = useState<number | null>(null)

  const handleRetry = (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (retryAnalysis.isPending) return
    setRetryingId(id)
    retryAnalysis.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("심사를 다시 시작했습니다")
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() })
        },
        onError: (err) => {
          const data = (err as { data?: { error?: string } | null })?.data
          toast.error(data?.error || "재시도에 실패했습니다")
        },
        onSettled: () => setRetryingId(null),
      }
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI 서류 심사 내역</h1>
          <p className="text-muted-foreground mt-1">서류 심사 결과를 확인하세요.</p>
        </div>
        <Link href="/analyses/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> 새 심사 시작
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : analyses?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BrainCircuit className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">심사 내역이 없습니다</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              이력서와 지원 회사를 선택해 AI 심사를 시작하세요.
            </p>
            <Link href="/analyses/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              첫 심사 시작하기
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {analyses?.map(analysis => (
            <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{analysis.resumeTitle || "제목 없음"}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Building2 className="w-4 h-4" /> {analysis.companyName || "회사 미등록"}</span>
                      <span>•</span>
                      <span>{format(new Date(analysis.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      {analysis.status === "completed" ? (
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-bold font-mono tracking-tighter">
                            {analysis.overallScore}<span className="text-base text-muted-foreground font-sans">/100</span>
                          </span>
                          {analysis.overallResult === "pass" ? (
                            <Badge variant="success" className="mt-1">합격</Badge>
                          ) : (
                            <Badge variant="destructive" className="mt-1">불합격</Badge>
                          )}
                        </div>
                      ) : analysis.status === "failed" ? (
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> 심사 실패
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retryingId === analysis.id}
                            onClick={(e) => handleRetry(e, analysis.id)}
                          >
                            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${retryingId === analysis.id ? "animate-spin" : ""}`} />
                            {retryingId === analysis.id ? "재시도 중..." : "다시 시도"}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 분석 중
                          </Badge>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground hidden md:block" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
