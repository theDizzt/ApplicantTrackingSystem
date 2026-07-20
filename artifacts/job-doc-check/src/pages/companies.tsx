import { useState } from "react"
import {
  useListCompanies,
  useDeleteCompany,
  useRecommendCompanies,
  useListResumes,
  getListCompaniesQueryKey,
} from "@workspace/api-client-react"
import { Link } from "wouter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Building2, Globe, Trash2, Plus, FileText, Star, RefreshCw, ChevronDown,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function CompaniesPage() {
  const { data: companies, isLoading } = useListCompanies()
  const { data: resumes } = useListResumes()
  const deleteCompany   = useDeleteCompany()
  const recommend       = useRecommendCompanies()
  const queryClient     = useQueryClient()
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)

  const handleDelete = (id: number) => {
    deleteCompany.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }),
    })
  }

  const handleRecommend = () => {
    const rid = selectedResumeId ?? resumes?.[0]?.id
    if (!rid) return
    recommend.mutate(
      { data: { resumeId: rid } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }) }
    )
  }

  // 동기화 날짜 표시 (company 목록의 첫 syncedAt 기준)
  const latestSyncedAt = companies?.[0]?.syncedAt
  const syncedLabel = latestSyncedAt
    ? new Date(latestSyncedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null

  // 다음 업데이트: 오늘 이후의 첫 번째 월요일
  const nextMonday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 1 ? 7 : (8 - day) % 7
    d.setDate(d.getDate() + diff)
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  })()

  const recommendedCount = companies?.filter(c => c.isRecommended).length ?? 0
  const selectedResume   = resumes?.find(r => r.id === selectedResumeId) ?? resumes?.[0]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">지원 회사 목록</h1>
          <p className="text-muted-foreground mt-1">지원하려는 회사 정보를 관리하세요.</p>
        </div>
        <Link
          href="/companies/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" /> 회사 추가
        </Link>
      </div>

      {/* ── 추천 + 동기화 패널 ───────────────────────────────────── */}
      {!isLoading && (companies?.length ?? 0) > 0 && (
        <Card className="border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 dark:border-blue-900/40">
          <CardContent className="py-4 px-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">

              {/* 왼쪽: 업데이트 안내 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  {syncedLabel ? (
                    <>마지막 업데이트 <strong className="text-foreground">{syncedLabel}</strong> · 다음 업데이트 <strong className="text-foreground">{nextMonday}</strong></>
                  ) : "매주 월요일 오전 9시 자동 업데이트"}
                </span>
              </div>

              {/* 오른쪽: 이력서 선택 + 추천 받기 */}
              <div className="flex items-center gap-2">
                {(resumes?.length ?? 0) > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 max-w-[200px]">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{selectedResume?.title ?? "이력서 선택"}</span>
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {resumes?.map(r => (
                        <DropdownMenuItem
                          key={r.id}
                          onClick={() => setSelectedResumeId(r.id)}
                          className={r.id === (selectedResumeId ?? resumes[0]?.id) ? "bg-accent" : ""}
                        >
                          {r.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : selectedResume ? (
                  <span className="text-xs text-muted-foreground border rounded-md px-2.5 py-1.5 bg-background">
                    <FileText className="w-3 h-3 inline mr-1" />{selectedResume.title}
                  </span>
                ) : null}

                <Button
                  size="sm"
                  onClick={handleRecommend}
                  disabled={recommend.isPending || !selectedResume}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Star className="w-3.5 h-3.5" />
                  {recommend.isPending ? "분석 중…" : "이력서로 추천 받기"}
                </Button>

                {recommendedCount > 0 && (
                  <Badge variant="secondary" className="shrink-0">
                    추천 {recommendedCount}개
                  </Badge>
                )}
              </div>
            </div>

            {recommend.isPending && (
              <p className="text-xs text-blue-600 mt-2 animate-pulse">
                AI가 이력서와 각 회사 채용 공고를 비교 분석 중입니다…
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── 회사 카드 목록 ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : companies?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">등록된 회사가 없습니다</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              AI 심사를 진행할 회사를 먼저 등록해주세요.
            </p>
            <Link
              href="/companies/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              첫 회사 등록하기
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 추천 회사를 먼저, 나머지는 등록 순 */}
          {[
            ...(companies?.filter(c => c.isRecommended) ?? []),
            ...(companies?.filter(c => !c.isRecommended) ?? []),
          ].map(company => (
            <Card
              key={company.id}
              className={[
                "flex flex-col transition-shadow",
                company.isRecommended
                  ? "ring-2 ring-blue-400/60 shadow-md shadow-blue-100 dark:shadow-blue-900/20"
                  : "",
              ].join(" ")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-start gap-2">
                  <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="flex-1 leading-snug">{company.name}</span>
                  {company.isRecommended && (
                    <Badge className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-600 text-white text-[11px] px-2 py-0.5">
                      <Star className="w-3 h-3 fill-white" />
                      추천
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {company.siteUrl || "웹사이트 미등록"}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-0">
                <div className="space-y-2 text-sm">
                  {company.jobPostingUrl && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                      <a
                        href={company.jobPostingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-primary line-clamp-1"
                      >
                        채용공고 바로가기
                      </a>
                    </div>
                  )}
                  {company.talentProfile && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 text-xs">
                        {company.talentProfile.split("/")[0]?.trim()}
                      </span>
                    </div>
                  )}
                  {company.notes && (
                    <p className="text-[11px] text-muted-foreground/70 line-clamp-1 pt-0.5">
                      {company.notes}
                    </p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 py-3 border-t">
                <Link
                  href={`/companies/${company.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  상세보기
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>회사를 삭제하시겠습니까?</AlertDialogTitle>
                      <AlertDialogDescription>
                        이 작업은 되돌릴 수 없습니다. 회사 프로필이 영구적으로 삭제됩니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(company.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
