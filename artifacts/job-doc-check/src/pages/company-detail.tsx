import { useEffect, useRef } from "react"
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
import { ChevronLeft, Save } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "", siteUrl: "", jobPostingUrl: "",
      talentProfile: "", jobDescription: "", notes: "",
      careerLevel: [], educationLevel: "", recruitmentField: [],
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
