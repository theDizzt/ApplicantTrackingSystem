import { useState, useMemo } from "react"
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
  Building2, Globe, Trash2, Plus, FileText, Star, RefreshCw, ChevronDown, Filter, X,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ── 필터 옵션 ────────────────────────────────────────────────────────────────
const CAREER_LEVELS      = ["신입", "1년이내", "3년이내"] as const
const EDUCATION_LEVELS   = ["전문대", "대학교", "석사"] as const
const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const

// 필드별 색상 (모집분야 배지)
const FIELD_COLORS: Record<string, string> = {
  개발: "bg-blue-100 text-blue-700",
  기획: "bg-violet-100 text-violet-700",
  디자인: "bg-pink-100 text-pink-700",
  영업: "bg-orange-100 text-orange-700",
  품질관리: "bg-teal-100 text-teal-700",
  테스터: "bg-cyan-100 text-cyan-700",
  기타: "bg-slate-100 text-slate-600",
}
const CAREER_COLORS: Record<string, string> = {
  신입: "bg-emerald-100 text-emerald-700",
  "1년이내": "bg-lime-100 text-lime-700",
  "3년이내": "bg-amber-100 text-amber-700",
}

// ── 토글 버튼 ────────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-input hover:border-primary/60"
      )}
    >
      {label}
    </button>
  )
}

export default function CompaniesPage() {
  const { data: companies, isLoading } = useListCompanies()
  const { data: resumes } = useListResumes()
  const deleteCompany = useDeleteCompany()
  const recommend     = useRecommendCompanies()
  const queryClient   = useQueryClient()

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)

  // ── 활성 필터 상태 ──────────────────────────────────────────────────────────
  const [filterCareer,    setFilterCareer]    = useState<string[]>([])
  const [filterEducation, setFilterEducation] = useState<string[]>([])
  const [filterField,     setFilterField]     = useState<string[]>([])

  const toggleFilter = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const hasActiveFilter = filterCareer.length > 0 || filterEducation.length > 0 || filterField.length > 0
  const clearFilters = () => { setFilterCareer([]); setFilterEducation([]); setFilterField([]) }

  // ── 필터 적용 ──────────────────────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    if (!companies) return []
    return companies.filter(c => {
      if (filterCareer.length > 0 && !filterCareer.some(f => (c.careerLevel ?? []).includes(f))) return false
      if (filterEducation.length > 0 && !filterEducation.includes(c.educationLevel ?? "")) return false
      if (filterField.length > 0 && !filterField.some(f => (c.recruitmentField ?? []).includes(f))) return false
      return true
    })
  }, [companies, filterCareer, filterEducation, filterField])

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

  const latestSyncedAt = companies?.[0]?.syncedAt
  const syncedLabel = latestSyncedAt
    ? new Date(latestSyncedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
    : null

  const nextMonday = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 1 ? 7 : (8 - day) % 7
    d.setDate(d.getDate() + diff)
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  })()

  const recommendedCount = companies?.filter(c => c.isRecommended).length ?? 0
  const selectedResume   = resumes?.find(r => r.id === selectedResumeId) ?? resumes?.[0]

  // 추천 먼저, 그 다음 등록순
  const sortedFiltered = [
    ...filteredCompanies.filter(c => c.isRecommended),
    ...filteredCompanies.filter(c => !c.isRecommended),
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── 헤더 ── */}
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

      {/* ── 추천 + 동기화 패널 ── */}
      {!isLoading && (companies?.length ?? 0) > 0 && (
        <Card className="border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <CardContent className="py-4 px-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  {syncedLabel ? (
                    <>마지막 업데이트 <strong className="text-foreground">{syncedLabel}</strong> · 다음 업데이트 <strong className="text-foreground">{nextMonday}</strong></>
                  ) : "매주 월요일 오전 9시 자동 업데이트"}
                </span>
              </div>
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
                  <Badge variant="secondary" className="shrink-0">추천 {recommendedCount}개</Badge>
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

      {/* ── 필터 패널 ── */}
      {!isLoading && (companies?.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-slate-50/60 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Filter className="w-3.5 h-3.5" /> 필터
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" /> 초기화
              </button>
            )}
          </div>

          {/* 경력구분 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">경력구분</span>
            {CAREER_LEVELS.map(opt => (
              <FilterChip
                key={opt}
                label={opt}
                active={filterCareer.includes(opt)}
                onClick={() => toggleFilter(setFilterCareer, opt)}
              />
            ))}
          </div>

          {/* 학력 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">학력</span>
            {EDUCATION_LEVELS.map(opt => (
              <FilterChip
                key={opt}
                label={opt}
                active={filterEducation.includes(opt)}
                onClick={() => toggleFilter(setFilterEducation, opt)}
              />
            ))}
          </div>

          {/* 모집분야 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">모집분야</span>
            {RECRUITMENT_FIELDS.map(opt => (
              <FilterChip
                key={opt}
                label={opt}
                active={filterField.includes(opt)}
                onClick={() => toggleFilter(setFilterField, opt)}
              />
            ))}
          </div>

          {/* 필터 결과 수 */}
          {hasActiveFilter && (
            <p className="text-xs text-muted-foreground pt-0.5">
              전체 {companies?.length ?? 0}개 중 <strong className="text-foreground">{filteredCompanies.length}개</strong> 표시
            </p>
          )}
        </div>
      )}

      {/* ── 회사 카드 목록 ── */}
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
      ) : sortedFiltered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold">조건에 맞는 회사가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">필터를 조정하거나 초기화해 보세요.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              필터 초기화
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedFiltered.map(company => (
            <Card
              key={company.id}
              className={cn(
                "flex flex-col transition-shadow",
                company.isRecommended ? "ring-2 ring-blue-400/60 shadow-md shadow-blue-100" : ""
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-start gap-2">
                  <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="flex-1 leading-snug">{company.name}</span>
                  {company.isRecommended && (
                    <Badge className="shrink-0 gap-1 bg-blue-600 hover:bg-blue-600 text-white text-[11px] px-2 py-0.5">
                      <Star className="w-3 h-3 fill-white" />추천
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  {company.siteUrl || "웹사이트 미등록"}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-0 space-y-2.5">
                {/* 분류 배지 */}
                {((company.careerLevel?.length ?? 0) > 0 ||
                  company.educationLevel ||
                  (company.recruitmentField?.length ?? 0) > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {/* 경력 */}
                    {(company.careerLevel ?? []).map(cl => (
                      <span key={cl} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", CAREER_COLORS[cl] ?? "bg-slate-100 text-slate-600")}>
                        {cl}
                      </span>
                    ))}
                    {/* 학력 */}
                    {company.educationLevel && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {company.educationLevel} 이상
                      </span>
                    )}
                    {/* 모집분야 */}
                    {(company.recruitmentField ?? []).map(rf => (
                      <span key={rf} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", FIELD_COLORS[rf] ?? "bg-slate-100 text-slate-600")}>
                        {rf}
                      </span>
                    ))}
                  </div>
                )}

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
                      <span className="line-clamp-2 text-xs">{company.talentProfile.split("/")[0]?.trim()}</span>
                    </div>
                  )}
                  {company.notes && (
                    <p className="text-[11px] text-muted-foreground/70 line-clamp-1 pt-0.5">{company.notes}</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center bg-slate-50/50 py-3 border-t">
                <Link href={`/companies/${company.id}`} className="text-sm font-medium text-primary hover:underline">
                  상세보기
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
