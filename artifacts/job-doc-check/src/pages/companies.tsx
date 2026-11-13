import { useState, useMemo, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import {
  useListCompanies,
  useDeleteCompany,
  useRecommendCompanies,
  useCreateCompany,
  useFetchPostings,
  useListResumes,
  getListCompaniesQueryKey,
} from "@workspace/api-client-react"
import type { JobPosting } from "@workspace/api-client-react"
import { Link } from "wouter"
import { dDayLabel, daysUntil, scheduleEvents, SCHEDULE_KIND_LABEL, toDateKey } from "@/lib/schedule"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Building2, Globe, Trash2, Plus, FileText, Star, RefreshCw,
  ChevronDown, Filter, X, CloudDownload, Check, ExternalLink,
  Loader2, Sparkles, Search, MapPin,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// ── 필터 옵션 ────────────────────────────────────────────────────────────────
const CAREER_LEVELS      = ["신입", "1년이내", "3년이내"] as const
const EDUCATION_LEVELS   = ["전문대", "대학교", "석사"] as const
const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const

// 필드별 색상
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

// ── 토글 필터 칩 ──────────────────────────────────────────────────────────────
/** 선호 근무지역 (사람인 시·도 단위) */
const REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const
const REGION_STORAGE_KEY = "ats.preferredRegions"

/** 브라우저에 기억해 두는 선호 지역 (다음에 와도 그대로) */
function usePreferredRegions() {
  const [regions, setRegions] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REGION_STORAGE_KEY) ?? "[]")
      return Array.isArray(saved) ? saved.filter((r): r is string => (REGIONS as readonly string[]).includes(r)) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try { localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(regions)) } catch { /* 저장 실패는 무시 */ }
  }, [regions])
  return [regions, setRegions] as const
}

function regionLabel(regions: string[]) {
  if (regions.length === 0) return "전국"
  if (regions.length <= 2) return regions.join("·")
  return `${regions[0]} 외 ${regions.length - 1}곳`
}

function RegionPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (region: string) =>
    onChange(value.includes(region) ? value.filter(r => r !== region) : REGIONS.filter(r => r === region || value.includes(r)))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 max-w-[180px]", value.length > 0 && "border-primary/40 text-primary")}
          data-testid="button-region-picker"
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">선호 지역: {regionLabel(value)}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          여러 곳을 고를 수 있어요. 비우면 전국에서 찾습니다.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-x-1 max-h-72 overflow-y-auto">
          {REGIONS.map(region => (
            <DropdownMenuCheckboxItem
              key={region}
              checked={value.includes(region)}
              onCheckedChange={() => toggle(region)}
              onSelect={e => e.preventDefault()}
            >
              {region}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])} className="text-xs justify-center text-muted-foreground">
              선택 해제 (전국)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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

// ── 분류 배지 묶음 ────────────────────────────────────────────────────────────
function ClassificationBadges({
  careerLevel, educationLevel, recruitmentField,
}: { careerLevel?: string[] | null; educationLevel?: string | null; recruitmentField?: string[] | null }) {
  const hasBadges =
    (careerLevel?.length ?? 0) > 0 || educationLevel || (recruitmentField?.length ?? 0) > 0
  if (!hasBadges) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {(careerLevel ?? []).map(cl => (
        <span key={cl} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", CAREER_COLORS[cl] ?? "bg-slate-100 text-slate-600")}>{cl}</span>
      ))}
      {educationLevel && (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{educationLevel} 이상</span>
      )}
      {(recruitmentField ?? []).map(rf => (
        <span key={rf} className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", FIELD_COLORS[rf] ?? "bg-slate-100 text-slate-600")}>{rf}</span>
      ))}
    </div>
  )
}

// ── 채용공고 결과 다이얼로그 ──────────────────────────────────────────────────
/** 이력서 기반 검색 결과는 공고마다 적합도 점수와 이유가 붙는다. */
type FoundPosting = JobPosting & {
  matchScore?: number | null
  matchReason?: string | null
  /** 사람인 목록 마감 표시에서 읽은 서류 마감일 (YYYY-MM-DD) */
  deadlineDate?: string | null
  deadlineText?: string | null
}

type DiscoverResponse = { jobs: string[]; keywords: string[]; regions?: string[]; postings: FoundPosting[] }

function matchScoreClass(score: number) {
  if (score >= 70) return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (score >= 50) return "bg-amber-50 text-amber-700 ring-amber-200"
  return "bg-slate-100 text-slate-600 ring-slate-200"
}

function FetchedPostingsDialog({
  open,
  onClose,
  postings,
  onAdd,
  addingIds,
  addedIds,
  title = "AI 채용공고 검색 결과",
  description = "선택한 필터 조건에 맞는 채용공고입니다. 추가할 공고를 선택하세요.",
  summary,
}: {
  open: boolean
  onClose: () => void
  postings: FoundPosting[]
  onAdd: (posting: FoundPosting, index: number) => void
  addingIds: Set<number>
  addedIds: Set<number>
  title?: string
  description?: string
  summary?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {summary}

        {postings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">검색 결과가 없습니다.</p>
        ) : (
          <div className="space-y-3 mt-2">
            {postings.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-4 space-y-2 transition-colors",
                  addedIds.has(i) ? "bg-green-50 border-green-200" : "bg-background"
                )}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm leading-snug">{p.name}</p>
                      {(p.deadlineDate || p.deadlineText) && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200">
                          {p.deadlineDate ? `마감 ${p.deadlineDate.slice(5).replace("-", "/")}` : p.deadlineText}
                        </span>
                      )}
                      {p.matchScore != null && (
                        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full ring-1", matchScoreClass(p.matchScore))}>
                          적합도 {p.matchScore}
                        </span>
                      )}
                    </div>
                    {p.siteUrl && (
                      <a
                        href={p.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="w-3 h-3" />{p.siteUrl}
                      </a>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={addedIds.has(i) ? "outline" : "default"}
                    disabled={addingIds.has(i) || addedIds.has(i)}
                    onClick={() => onAdd(p, i)}
                    className={cn(
                      "shrink-0 gap-1.5 text-xs h-8",
                      addedIds.has(i) && "border-green-400 text-green-700 bg-green-50 hover:bg-green-50"
                    )}
                  >
                    {addingIds.has(i) ? (
                      <><Loader2 className="w-3 h-3 animate-spin" />추가 중</>
                    ) : addedIds.has(i) ? (
                      <><Check className="w-3 h-3" />추가됨</>
                    ) : (
                      <><Plus className="w-3 h-3" />추가</>
                    )}
                  </Button>
                </div>

                {/* 분류 배지 */}
                <ClassificationBadges
                  careerLevel={p.careerLevel}
                  educationLevel={p.educationLevel}
                  recruitmentField={p.recruitmentField}
                />

                {/* 적합 이유 (이력서 기반 검색) */}
                {p.matchReason && (
                  <p className="text-xs text-slate-700 bg-slate-50 rounded-md px-2.5 py-1.5 leading-relaxed">
                    <Sparkles className="w-3 h-3 inline mr-1 text-primary" />{p.matchReason}
                  </p>
                )}

                {/* 인재상 */}
                {p.talentProfile && (
                  <p className="text-xs text-muted-foreground italic line-clamp-2">{p.talentProfile}</p>
                )}

                {/* 직무설명 */}
                {p.jobDescription && (
                  <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">{p.jobDescription}</p>
                )}

                {/* 채용공고 링크 */}
                {p.jobPostingUrl && (
                  <a
                    href={p.jobPostingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />채용공고 바로가기
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
/** 지원 상태와 가장 가까운 남은 일정 (예: "지원 완료 · 결과 발표 D-3"). */
function ScheduleLine({ company }: { company: Parameters<typeof scheduleEvents>[0][number] }) {
  const today = toDateKey(new Date())
  const next = scheduleEvents([company]).find((e) => daysUntil(e.date, today) >= 0)
  if (!company.applicationStatus && !next) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs" data-testid={`schedule-${company.id}`}>
      {company.applicationStatus && (
        <span className="rounded-full bg-slate-800 text-white px-2 py-0.5 font-medium">{company.applicationStatus}</span>
      )}
      {next && (
        <span className={cn(
          "rounded-full border px-2 py-0.5 font-medium",
          daysUntil(next.date, today) <= 3 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600",
        )}>
          {SCHEDULE_KIND_LABEL[next.kind]} {dDayLabel(next.date, today)}
        </span>
      )}
    </div>
  )
}

export default function CompaniesPage() {
  const { data: companies, isLoading } = useListCompanies()
  const { data: resumes } = useListResumes()
  const deleteCompany  = useDeleteCompany()
  const recommend      = useRecommendCompanies()
  const createCompany  = useCreateCompany()
  const fetchPostings  = useFetchPostings()
  const queryClient    = useQueryClient()
  const { toast }      = useToast()

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)

  // ── 활성 필터 상태 ──────────────────────────────────────────────────────────
  const [filterCareer,    setFilterCareer]    = useState<string[]>([])
  const [filterEducation, setFilterEducation] = useState<string[]>([])
  const [filterField,     setFilterField]     = useState<string[]>([])
  const [preferredRegions, setPreferredRegions] = usePreferredRegions()

  const toggleFilter = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const hasActiveFilter = filterCareer.length > 0 || filterEducation.length > 0 || filterField.length > 0
  const clearFilters = () => { setFilterCareer([]); setFilterEducation([]); setFilterField([]) }

  // ── 채용공고 다이얼로그 상태 ────────────────────────────────────────────────
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [postings,    setPostings]    = useState<FoundPosting[]>([])
  const [dialogMode,  setDialogMode]  = useState<"filter" | "resume">("filter")
  const [discoverInfo, setDiscoverInfo] = useState<{ jobs: string[]; keywords: string[]; regions: string[] } | null>(null)

  // ── 이력서로 채용공고 찾기 ──────────────────────────────────────────────────
  const discover = useMutation({
    mutationFn: async ({ resumeId, regions }: { resumeId: number; regions: string[] }): Promise<DiscoverResponse> => {
      const res = await fetch("/api/companies/discover", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, regions }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "채용공고를 찾지 못했습니다.")
      return body as DiscoverResponse
    },
  })
  const [addingIds,   setAddingIds]   = useState<Set<number>>(new Set())
  const [addedIds,    setAddedIds]    = useState<Set<number>>(new Set())

  // ── 채용공고 가져오기 ───────────────────────────────────────────────────────
  const handleFetchPostings = () => {
    setAddingIds(new Set())
    setAddedIds(new Set())
    fetchPostings.mutate(
      {
        data: {
          careerLevel:     filterCareer.length     ? filterCareer     : undefined,
          educationLevel:  filterEducation.length  ? filterEducation[0] : undefined,
          recruitmentField: filterField.length     ? filterField      : undefined,
          regions:          preferredRegions.length ? preferredRegions : undefined,
        },
      },
      {
        onSuccess: (data) => {
          setPostings(data)
          setDialogMode("filter")
          setDialogOpen(true)
        },
        onError: () => {
          toast({ title: "오류", description: "채용공고를 가져오지 못했습니다.", variant: "destructive" })
        },
      }
    )
  }

  // ── 공고 → 회사 추가 ────────────────────────────────────────────────────────
  const handleAddPosting = (posting: FoundPosting, index: number) => {
    setAddingIds(prev => new Set(prev).add(index))
    createCompany.mutate(
      {
        data: {
          name:             posting.name,
          siteUrl:          posting.siteUrl ?? undefined,
          jobPostingUrl:    posting.jobPostingUrl ?? undefined,
          talentProfile:    posting.talentProfile ?? undefined,
          jobDescription:   posting.jobDescription ?? undefined,
          careerLevel:      posting.careerLevel ?? undefined,
          educationLevel:   posting.educationLevel ?? undefined,
          recruitmentField: posting.recruitmentField ?? undefined,
          // 마감일이 있으면 지원 일정 캘린더에 바로 표시된다
          deadlineDate:     posting.deadlineDate ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setAddingIds(prev => { const s = new Set(prev); s.delete(index); return s })
          setAddedIds(prev => new Set(prev).add(index))
          queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() })
          toast({ title: "추가 완료", description: `${posting.name}이(가) 회사 목록에 추가됐습니다.` })
        },
        onError: () => {
          setAddingIds(prev => { const s = new Set(prev); s.delete(index); return s })
          toast({ title: "오류", description: "회사 추가에 실패했습니다.", variant: "destructive" })
        },
      }
    )
  }

  // ── 필터 적용 ──────────────────────────────────────────────────────────────
  const filteredCompanies = useMemo(() => {
    if (!companies) return []
    return companies.filter(c => {
      if (filterCareer.length    > 0 && !filterCareer.some(f => (c.careerLevel ?? []).includes(f))) return false
      if (filterEducation.length > 0 && !filterEducation.includes(c.educationLevel ?? ""))         return false
      if (filterField.length     > 0 && !filterField.some(f => (c.recruitmentField ?? []).includes(f))) return false
      return true
    })
  }, [companies, filterCareer, filterEducation, filterField])

  const handleDelete = (id: number) => {
    deleteCompany.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() }),
    })
  }

  const handleDiscover = () => {
    const rid = selectedResumeId ?? resumes?.[0]?.id
    if (!rid) return
    setAddingIds(new Set())
    setAddedIds(new Set())
    discover.mutate({ resumeId: rid, regions: preferredRegions }, {
      onSuccess: (data) => {
        setPostings(data.postings)
        setDiscoverInfo({ jobs: data.jobs, keywords: data.keywords, regions: data.regions ?? [] })
        setDialogMode("resume")
        setDialogOpen(true)
      },
      onError: (err) => {
        toast({ title: "오류", description: err instanceof Error ? err.message : "채용공고를 찾지 못했습니다.", variant: "destructive" })
      },
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
    const d = new Date(); const day = d.getDay()
    const diff = day === 1 ? 7 : (8 - day) % 7
    d.setDate(d.getDate() + diff)
    return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  })()

  const recommendedCount = companies?.filter(c => c.isRecommended).length ?? 0
  const selectedResume   = resumes?.find(r => r.id === selectedResumeId) ?? resumes?.[0]

  const resumePicker = (resumes?.length ?? 0) > 1 ? (
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
  ) : null

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

      {/* ── 이력서로 채용공고 찾기 ── */}
      {!isLoading && (
        <Card className="border-primary/20">
          <CardContent className="py-4 px-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
              <div className="space-y-0.5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Search className="w-4 h-4 text-primary shrink-0" />이력서로 맞는 채용공고 찾기
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedResume
                    ? "이력서에 맞는 직무를 찾고, 사람인의 실제 공고를 적합도 순으로 보여줍니다."
                    : <>먼저 <Link href="/resumes/new" className="text-primary hover:underline">이력서를 등록</Link>해주세요.</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RegionPicker value={preferredRegions} onChange={setPreferredRegions} />
                {resumePicker}
                <Button
                  size="sm"
                  onClick={handleDiscover}
                  disabled={discover.isPending || !selectedResume}
                  className="gap-1.5"
                >
                  {discover.isPending
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />찾는 중…</>
                    : <><Search className="w-3.5 h-3.5" />채용공고 찾기</>}
                </Button>
              </div>
            </div>
            {discover.isPending && (
              <p className="text-xs text-primary mt-2 animate-pulse">
                이력서에서 직무를 뽑고 사람인 공고를 검색해 적합도를 평가하는 중입니다… (30초~1분 정도 걸립니다)
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
                {resumePicker}
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
            <div className="flex items-center gap-2">
              {/* ── 채용공고 가져오기 아이콘 버튼 ── */}
              <button
                type="button"
                onClick={handleFetchPostings}
                disabled={!hasActiveFilter || fetchPostings.isPending}
                title={hasActiveFilter ? "필터 조건으로 채용공고 가져오기" : "필터를 먼저 선택하세요"}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all",
                  hasActiveFilter
                    ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 shadow-sm"
                    : "bg-background text-muted-foreground/50 border-input cursor-not-allowed"
                )}
              >
                {fetchPostings.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />검색 중…</>
                ) : (
                  <><CloudDownload className="w-3.5 h-3.5" />채용공고 가져오기</>
                )}
              </button>
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
          </div>

          {/* 경력구분 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">경력구분</span>
            {CAREER_LEVELS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterCareer.includes(opt)} onClick={() => toggleFilter(setFilterCareer, opt)} />
            ))}
          </div>

          {/* 학력 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">학력</span>
            {EDUCATION_LEVELS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterEducation.includes(opt)} onClick={() => toggleFilter(setFilterEducation, opt)} />
            ))}
          </div>

          {/* 모집분야 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">모집분야</span>
            {RECRUITMENT_FIELDS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterField.includes(opt)} onClick={() => toggleFilter(setFilterField, opt)} />
            ))}
          </div>

          {/* 근무지역 (채용공고 검색에만 적용) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">근무지역</span>
            <RegionPicker value={preferredRegions} onChange={setPreferredRegions} />
          </div>

          {/* 안내 문구 */}
          <p className="text-[11px] text-muted-foreground pt-0.5">
            {hasActiveFilter
              ? <>전체 {companies?.length ?? 0}개 중 <strong className="text-foreground">{filteredCompanies.length}개</strong> 표시 · 필터 조건으로 채용공고를 가져와 목록에 추가할 수 있습니다.</>
              : "필터를 선택하면 해당 조건의 채용공고를 AI로 검색할 수 있습니다."}
          </p>
        </div>
      )}

      {/* 필터가 활성이지만 회사가 없을 때도 필터 패널 표시 */}
      {!isLoading && (companies?.length ?? 0) === 0 && (
        <div className="rounded-xl border bg-slate-50/60 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Filter className="w-3.5 h-3.5" /> 필터로 채용공고 찾기
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">경력구분</span>
            {CAREER_LEVELS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterCareer.includes(opt)} onClick={() => toggleFilter(setFilterCareer, opt)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">학력</span>
            {EDUCATION_LEVELS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterEducation.includes(opt)} onClick={() => toggleFilter(setFilterEducation, opt)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">모집분야</span>
            {RECRUITMENT_FIELDS.map(opt => (
              <FilterChip key={opt} label={opt} active={filterField.includes(opt)} onClick={() => toggleFilter(setFilterField, opt)} />
            ))}
          </div>

          {/* 근무지역 (채용공고 검색에만 적용) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 shrink-0">근무지역</span>
            <RegionPicker value={preferredRegions} onChange={setPreferredRegions} />
          </div>
          <Button
            size="sm"
            onClick={handleFetchPostings}
            disabled={!hasActiveFilter || fetchPostings.isPending}
            className="gap-1.5 mt-1"
          >
            {fetchPostings.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />검색 중…</>
            ) : (
              <><CloudDownload className="w-4 h-4" />채용공고 가져오기</>
            )}
          </Button>
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
              직접 추가하거나, 위 필터로 AI 채용공고를 검색해 가져올 수 있습니다.
            </p>
            <Link
              href="/companies/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              직접 회사 등록
            </Link>
          </CardContent>
        </Card>
      ) : sortedFiltered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-semibold">조건에 맞는 회사가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">
              위 <strong>채용공고 가져오기</strong> 버튼으로 AI가 조건에 맞는 공고를 찾아드립니다.
            </p>
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
                <ScheduleLine company={company} />
                <ClassificationBadges
                  careerLevel={company.careerLevel}
                  educationLevel={company.educationLevel}
                  recruitmentField={company.recruitmentField}
                />
                <div className="space-y-2 text-sm">
                  {company.jobPostingUrl && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Globe className="w-4 h-4 shrink-0 mt-0.5" />
                      <a href={company.jobPostingUrl} target="_blank" rel="noreferrer"
                        className="hover:underline text-primary line-clamp-1">
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

      {/* ── 채용공고 결과 다이얼로그 ── */}
      <FetchedPostingsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        postings={postings}
        onAdd={handleAddPosting}
        addingIds={addingIds}
        addedIds={addedIds}
        {...(dialogMode === "resume" ? {
          title: "이력서 맞춤 채용공고",
          description: "사람인에서 찾은 실제 공고를 이력서 적합도 순으로 정렬했습니다. 점수는 공고 제목·조건 기준의 AI 추정치입니다.",
          summary: discoverInfo && (discoverInfo.jobs.length > 0 || discoverInfo.keywords.length > 0) ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-xs space-y-1">
              {discoverInfo.jobs.length > 0 && <p><span className="font-semibold">추천 직무</span> · {discoverInfo.jobs.join(", ")}</p>}
              {discoverInfo.keywords.length > 0 && <p className="text-muted-foreground"><span className="font-semibold">검색어</span> · {discoverInfo.keywords.join(", ")}</p>}
              <p className="text-muted-foreground"><span className="font-semibold">근무지역</span> · {regionLabel(discoverInfo.regions)}</p>
            </div>
          ) : undefined,
        } : {})}
      />
    </div>
  )
}
