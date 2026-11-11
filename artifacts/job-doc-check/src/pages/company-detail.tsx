import { useEffect, useRef, useState } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useCreateCompany, useUpdateCompany, useGetCompany, getGetCompanyQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, Save, Download, Loader2, CalendarSearch } from "lucide-react"
import { cn } from "@/lib/utils"
import { APPLICATION_STATUSES } from "@/lib/schedule"

// ── 옵션 정의 ────────────────────────────────────────────────────────────────
const CAREER_LEVELS    = ["신입", "1년이내", "3년이내"] as const
const EDUCATION_LEVELS = ["전문대", "대학교", "석사"] as const
const RECRUITMENT_FIELDS = ["개발", "기획", "디자인", "영업", "품질관리", "테스터", "기타"] as const

// ── 멀티토글 컴포넌트 ─────────────────────────────────────────────────────────
function MultiToggle({
  options, value, onChange,
}: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
            value.includes(opt)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input hover:border-primary/60"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── 싱글토글 컴포넌트 ─────────────────────────────────────────────────────────
function SingleToggle({
  options, value, onChange,
}: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? "" : opt)}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input hover:border-primary/60"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── 스키마 ────────────────────────────────────────────────────────────────────
const companySchema = z.object({
  name:             z.string().min(1, "회사명을 입력해주세요"),
  siteUrl:          z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  jobPostingUrl:    z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  talentProfile:    z.string().optional(),
  jobDescription:   z.string().optional(),
  notes:            z.string().optional(),
  careerLevel:      z.array(z.string()).optional(),
  educationLevel:   z.string().optional(),
  recruitmentField: z.array(z.string()).optional(),
  applicationStatus: z.string().optional(),
  deadlineDate:     z.string().optional(),
  announcementDate: z.string().optional(),
  interviewDate:    z.string().optional(),
})

type CompanyForm = z.infer<typeof companySchema>

// ── 페이지 ────────────────────────────────────────────────────────────────────
export default function CompanyDetail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const isNew = !params.id || params.id === "new"
  const companyId = isNew ? 0 : parseInt(params.id!, 10)

  const { data: company, isLoading } = useGetCompany(companyId, {
    query: { enabled: !isNew, queryKey: getGetCompanyQueryKey(companyId) }
  })

  const createCompany = useCreateCompany()
  const updateCompany = useUpdateCompany()

  // ── 채용 공고 URL 가져오기 ──────────────────────────────────────────────────
  const [fetchUrl, setFetchUrl] = useState("")
  const [isFetchingPosting, setIsFetchingPosting] = useState(false)

  // ── 공고 내용에서 지원 일정 찾기 ─────────────────────────────────────────────
  // 비어 있는 날짜 칸만 채운다. (직접 입력한 날짜는 덮어쓰지 않음)
  const [isExtractingDates, setIsExtractingDates] = useState(false)

  const extractDatesFromText = async (text: string, opts: { quiet?: boolean } = {}) => {
    setIsExtractingDates(true)
    try {
      const res = await fetch("/api/companies/extract-dates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "공고에서 일정을 찾지 못했습니다")
      const dates = (body.dates ?? {}) as Partial<Record<"deadlineDate" | "announcementDate" | "interviewDate", { date: string; evidence: string }>>
      const labels = { deadlineDate: "서류 마감", announcementDate: "결과 발표", interviewDate: "면접" } as const
      const filled: string[] = []
      const kept: string[] = []
      for (const key of ["deadlineDate", "announcementDate", "interviewDate"] as const) {
        const found = dates[key]
        if (!found) continue
        if (form.getValues(key)) { kept.push(labels[key]); continue }
        form.setValue(key, found.date, { shouldDirty: true, shouldValidate: true })
        filled.push(`${labels[key]} ${found.date}${found.evidence ? ` (“${found.evidence}”)` : ""}`)
      }
      if (filled.length > 0) {
        toast.success("공고에서 일정을 찾아 채웠습니다. 저장하면 캘린더에 표시됩니다.", { description: filled.join("\n") })
      } else if (kept.length > 0) {
        if (!opts.quiet) toast.info(`이미 입력된 날짜는 그대로 두었습니다 (${kept.join(", ")})`)
      } else if (!opts.quiet) {
        toast.info("공고에 날짜가 적혀 있지 않습니다. 날짜를 직접 입력해주세요.")
      }
    } catch (err: unknown) {
      if (!opts.quiet) toast.error(err instanceof Error ? err.message : "공고에서 일정을 찾지 못했습니다")
    } finally {
      setIsExtractingDates(false)
    }
  }

  const handleFetchPosting = async () => {
    const url = fetchUrl.trim()
    if (!url) { toast.error("채용 공고 URL을 입력해주세요"); return }
    setIsFetchingPosting(true)
    try {
      const res = await fetch("/api/companies/fetch-posting", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "공고를 가져오지 못했습니다")
      }
      const data: { ok: boolean; text: string; source: "html" | "ocr"; title?: string } = await res.json()
      const fetched = (data.text || "").trim()
      if (!fetched) {
        toast.error("공고에서 텍스트를 추출하지 못했습니다. 내용을 직접 붙여넣어 주세요.")
        return
      }
      const existing = (form.getValues("jobDescription") || "").trim()
      let next = fetched
      if (existing) {
        const append = window.confirm(
          "기존 채용공고 내용에 가져온 내용을 이어 붙일까요?\n(취소를 누르면 기존 내용을 덮어씁니다)"
        )
        next = append ? `${existing}\n\n${fetched}` : fetched
      }
      form.setValue("jobDescription", next, { shouldDirty: true, shouldValidate: true })
      if (!form.getValues("jobPostingUrl")) {
        form.setValue("jobPostingUrl", url, { shouldDirty: true })
      }
      toast.success(
        data.source === "ocr"
          ? "이미지 공고를 OCR로 읽어 채용공고 내용에 채웠습니다"
          : "채용공고 내용을 가져왔습니다"
      )
      // 가져온 공고에서 일정도 바로 찾아 빈 날짜 칸을 채운다 (실패해도 조용히 넘어감)
      void extractDatesFromText(fetched, { quiet: true })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "공고를 가져오지 못했습니다")
    } finally {
      setIsFetchingPosting(false)
    }
  }

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "", siteUrl: "", jobPostingUrl: "",
      talentProfile: "", jobDescription: "", notes: "",
      careerLevel: [], educationLevel: "", recruitmentField: [],
      applicationStatus: "", deadlineDate: "", announcementDate: "", interviewDate: "",
    }
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (company && !initializedRef.current) {
      form.reset({
        name:             company.name || "",
        siteUrl:          company.siteUrl || "",
        jobPostingUrl:    company.jobPostingUrl || "",
        talentProfile:    company.talentProfile || "",
        jobDescription:   company.jobDescription || "",
        notes:            company.notes || "",
        careerLevel:      (company.careerLevel as string[] | null) ?? [],
        educationLevel:   company.educationLevel || "",
        recruitmentField: (company.recruitmentField as string[] | null) ?? [],
        applicationStatus: company.applicationStatus || "",
        deadlineDate:     company.deadlineDate || "",
        announcementDate: company.announcementDate || "",
        interviewDate:    company.interviewDate || "",
      })
      initializedRef.current = true
    }
  }, [company, form])

  const onSubmit = (values: CompanyForm) => {
    const payload = {
      ...values,
      careerLevel:      values.careerLevel?.length      ? values.careerLevel      : undefined,
      educationLevel:   values.educationLevel            ? values.educationLevel   : undefined,
      recruitmentField: values.recruitmentField?.length  ? values.recruitmentField : undefined,
      // 일정·상태는 비우면 null로 보내 지운다 (새 회사는 보내지 않음)
      applicationStatus: values.applicationStatus || (isNew ? undefined : null),
      deadlineDate:     values.deadlineDate     || (isNew ? undefined : null),
      announcementDate: values.announcementDate || (isNew ? undefined : null),
      interviewDate:    values.interviewDate    || (isNew ? undefined : null),
    }
    if (isNew) {
      createCompany.mutate({ data: payload }, {
        onSuccess: () => { toast.success("회사가 등록되었습니다"); setLocation("/companies") },
        onError:   () => toast.error("회사 등록에 실패했습니다"),
      })
    } else {
      updateCompany.mutate({ id: companyId, data: payload }, {
        onSuccess: (updated) => {
          toast.success("회사 정보가 수정되었습니다")
          queryClient.setQueryData(getGetCompanyQueryKey(companyId), updated)
        },
        onError: () => toast.error("회사 정보 수정에 실패했습니다"),
      })
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="space-y-8 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const isPending = createCompany.isPending || updateCompany.isPending

  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/companies")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? "새 회사 등록" : "회사 정보 수정"}
          </h1>
          <p className="text-muted-foreground mt-1">
            상세한 정보를 입력할수록 AI 분석이 정확해집니다.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── 기본 정보 ── */}
          <div className="grid md:grid-cols-2 gap-6">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>회사명</FormLabel>
                <FormControl>
                  <Input placeholder="예: 토스, 네이버, 카카오..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="siteUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>회사 홈페이지</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="jobPostingUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>채용공고 URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* ── 채용 분류 (신규) ── */}
          <div className="rounded-xl border bg-slate-50/60 p-5 space-y-5">
            <p className="text-sm font-semibold text-slate-700">채용 분류</p>

            {/* 경력구분 — 복수 선택 */}
            <FormItem>
              <FormLabel className="text-sm">경력구분</FormLabel>
              <FormDescription>해당하는 경력을 모두 선택하세요.</FormDescription>
              <Controller
                control={form.control}
                name="careerLevel"
                render={({ field }) => (
                  <MultiToggle
                    options={CAREER_LEVELS}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormItem>

            {/* 학력 — 단일 선택 */}
            <FormItem>
              <FormLabel className="text-sm">최소 학력</FormLabel>
              <FormDescription>요구되는 최소 학력을 선택하세요.</FormDescription>
              <Controller
                control={form.control}
                name="educationLevel"
                render={({ field }) => (
                  <SingleToggle
                    options={EDUCATION_LEVELS}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormItem>

            {/* 모집분야 — 복수 선택 */}
            <FormItem>
              <FormLabel className="text-sm">모집분야</FormLabel>
              <FormDescription>모집하는 직무 분야를 모두 선택하세요.</FormDescription>
              <Controller
                control={form.control}
                name="recruitmentField"
                render={({ field }) => (
                  <MultiToggle
                    options={RECRUITMENT_FIELDS}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormItem>
          </div>

          {/* ── 지원 일정 ── */}
          <div className="rounded-xl border bg-slate-50/60 p-5 space-y-5" data-testid="section-schedule">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">지원 일정</p>
                <p className="text-xs text-muted-foreground mt-1">날짜를 넣으면 지원 일정 캘린더에 표시되고, 3일 전부터 알림이 뜹니다.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={isExtractingDates}
                data-testid="button-extract-dates"
                onClick={() => {
                  const text = (form.getValues("jobDescription") || "").trim()
                  if (text.length < 20) { toast.error("아래 채용공고 내용을 먼저 채워주세요"); return }
                  void extractDatesFromText(text)
                }}
              >
                {isExtractingDates
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />일정 찾는 중…</>
                  : <><CalendarSearch className="w-3.5 h-3.5" />공고에서 일정 찾기</>}
              </Button>
            </div>
            <FormItem>
              <FormLabel className="text-sm">지원 상태</FormLabel>
              <Controller
                control={form.control}
                name="applicationStatus"
                render={({ field }) => (
                  <SingleToggle
                    options={APPLICATION_STATUSES}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormItem>
            <div className="grid sm:grid-cols-3 gap-4">
              {([
                ["deadlineDate", "서류 마감일"],
                ["announcementDate", "결과 발표일"],
                ["interviewDate", "면접일"],
              ] as const).map(([name, label]) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm">{label}</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid={`input-${name}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
            </div>
          </div>

          {/* ── JD / 인재상 ── */}
          <FormField control={form.control} name="talentProfile" render={({ field }) => (
            <FormItem>
              <FormLabel>인재상</FormLabel>
              <FormDescription>회사의 인재상이나 핵심 가치를 붙여넣으세요.</FormDescription>
              <FormControl>
                <Textarea className="h-32 resize-none" placeholder="예: 고객 중심, 자기 주도적 문제 해결..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* ── 채용 공고 URL로 가져오기 ── */}
          <div className="rounded-xl border bg-slate-50/60 p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">채용 공고 URL로 가져오기</p>
              <p className="text-sm text-muted-foreground mt-1">
                사람인·잡코리아 등 공고 URL을 입력하면 내용을 자동으로 불러와 아래 채용공고 내용에 채웁니다.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="https://www.saramin.co.kr/..."
                value={fetchUrl}
                onChange={(e) => setFetchUrl(e.target.value)}
                disabled={isFetchingPosting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleFetchPosting() }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchPosting}
                disabled={isFetchingPosting}
                className="shrink-0"
              >
                {isFetchingPosting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Download className="w-4 h-4 mr-2" />}
                {isFetchingPosting ? "가져오는 중..." : "공고 가져오기"}
              </Button>
            </div>
          </div>

          <FormField control={form.control} name="jobDescription" render={({ field }) => (
            <FormItem>
              <FormLabel>채용공고 내용 (JD)</FormLabel>
              <FormDescription>담당 업무와 자격 요건을 붙여넣으세요. 직무 적합도 채점에 핵심적으로 사용됩니다.</FormDescription>
              <FormControl>
                <Textarea className="h-48 resize-none font-mono text-sm" placeholder="JD 전문을 붙여넣으세요..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>메모</FormLabel>
              <FormControl>
                <Textarea className="h-20" placeholder="지원 일정, 담당 리크루터 등 개인 메모..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/companies")}>취소</Button>
            <Button type="submit" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
