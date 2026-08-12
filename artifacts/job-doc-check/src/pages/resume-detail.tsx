import { useEffect, useRef, useState } from "react"
import { useLocation, useParams } from "wouter"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  useCreateResume, useUpdateResume, useGetResume, getGetResumeQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
  ChevronLeft, Save, Upload, Loader2, Banknote, FileDown,
  CheckCircle2, AlertTriangle, SpellCheck, Sparkles, Compass,
  TrendingUp, Award, RefreshCw,
} from "lucide-react"

import { RichTextEditor } from "@/components/rich-text-editor"

// ── 폼 스키마 ──────────────────────────────────────────────────────────────
const resumeSchema = z.object({
  title:         z.string().min(1, "제목을 입력해주세요"),
  content:       z.string().optional(),
  coverLetter:   z.string().optional(),
  desiredSalary: z.string().optional(),
})

type ResumeFormValues = z.infer<typeof resumeSchema>

interface SpellCorrection {
  field: string
  original: string
  corrected: string
  reason: string
}

interface SpellcheckResult {
  corrections: SpellCorrection[]
  contentCorrected: string
  coverLetterCorrected: string
}

// ── 커리어 분석 타입 ────────────────────────────────────────────────────────
interface CareerStrength { title: string; evidence: string }
interface CareerNcsCategory { major: string; middle: string; fitReason: string }
interface CareerRecommendedJob {
  job: string
  ncsCategory: string
  fitScore: number
  reason: string
  outlook: string
  outlookScore: number
}
interface CareerAnalysisResult {
  strengths: CareerStrength[]
  ncsCategories: CareerNcsCategory[]
  recommendedJobs: CareerRecommendedJob[]
  summary: string
}
interface CareerAnalysisState {
  inProgress: boolean
  error: string | null
  analyzedAt: string | null
  result: CareerAnalysisResult | null
}

// ── HTML → plain text ──────────────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim()
}

// ── 일반 텍스트 → 에디터용 HTML ───────────────────────────────────────────
function textToHtml(text: string): string {
  if (!text) return ""
  // 이미 HTML이면 그대로 반환
  if (text.startsWith("<")) return text
  return text
    .split("\n")
    .map(line => `<p>${line || "<br/>"}</p>`)
    .join("")
}

// ── PDF 다운로드 (print 방식, 한글 완벽 지원) ─────────────────────────────
function downloadPdf(title: string, content: string, coverLetter: string) {
  const fontUrl =
    "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="${fontUrl}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      font-size: 10.5pt;
      line-height: 1.8;
      color: #1a1a1a;
      padding: 30mm 20mm 24mm;
      word-break: keep-all;
    }
    h1.doc-title {
      font-size: 18pt;
      font-weight: 700;
      text-align: center;
      margin-bottom: 10mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #2563eb;
      color: #1e3a8a;
    }
    h2 { font-size: 13pt; font-weight: 700; margin: 7mm 0 3mm; color: #1e3a8a;
         border-bottom: 1px solid #bfdbfe; padding-bottom: 1.5mm; }
    h3 { font-size: 11pt; font-weight: 600; margin: 5mm 0 2mm; color: #1d4ed8; }
    p  { margin: 0 0 2mm; }
    ul, ol { margin: 0 0 3mm 5mm; }
    li { margin-bottom: 1mm; }
    strong { font-weight: 700; }
    em     { font-style: italic; }
    u      { text-decoration: underline; }
    hr     { border: none; border-top: 1px solid #e5e7eb; margin: 5mm 0; }
    section + section { margin-top: 8mm; }
    .section-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e3a8a;
      margin: 8mm 0 3mm;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 1.5mm;
    }
    @media print {
      @page { size: A4; margin: 0; }
      body { padding: 20mm 18mm 18mm; }
    }
  </style>
</head>
<body>
  <h1 class="doc-title">${title}</h1>
  ${content ? `<div class="section-title">이력서</div><section>${content}</section>` : ""}
  ${coverLetter ? `<div class="section-title">자기소개서</div><section>${coverLetter}</section>` : ""}
  <script>
    // 폰트 로드 후 인쇄
    document.fonts.ready.then(() => { window.print(); });
  </script>
</body>
</html>`

  const win = window.open("", "_blank")
  if (!win) {
    toast.error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.")
    return
  }
  win.document.write(html)
  win.document.close()
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function ResumeDetail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const isNew    = !params.id || params.id === "new"
  const resumeId = isNew ? 0 : parseInt(params.id!, 10)

  const { data: resume, isLoading } = useGetResume(resumeId, {
    query: { enabled: !isNew, queryKey: getGetResumeQueryKey(resumeId) },
  })

  const createResume = useCreateResume()
  const updateResume = useUpdateResume()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTitle,  setUploadTitle]  = useState("")
  const [isUploading,  setIsUploading]  = useState(false)

  // 맞춤법 검사 상태
  const [isChecking,      setIsChecking]      = useState(false)
  const [spellResult,     setSpellResult]     = useState<SpellcheckResult | null>(null)
  const [showSpellDialog, setShowSpellDialog] = useState(false)

  // 커리어 분석 상태
  const [career,        setCareer]        = useState<CareerAnalysisState | null>(null)
  const [careerLoading, setCareerLoading] = useState(false)
  const careerPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const form = useForm<ResumeFormValues>({
    resolver: zodResolver(resumeSchema),
    defaultValues: { title: "", content: "", coverLetter: "", desiredSalary: "" },
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (resume && !initializedRef.current) {
      form.reset({
        title:         resume.title         || "",
        content:       textToHtml(resume.content       || ""),
        coverLetter:   textToHtml(resume.coverLetter   || ""),
        desiredSalary: resume.desiredSalary != null ? String(resume.desiredSalary) : "",
      })
      initializedRef.current = true
    }
  }, [resume, form])

  // ── 커리어 분석: 상태 조회 & 폴링 ──────────────────────────────────────────
  // fatal: 재시도 불가(401/403/404) → 즉시 중단, transient: 일시 오류 → 카운트
  type FetchOutcome =
    | { kind: "ok"; data: CareerAnalysisState }
    | { kind: "fatal" }
    | { kind: "transient" }

  const fetchCareer = async (): Promise<FetchOutcome> => {
    if (isNew) return { kind: "fatal" }
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

  // 최초 진입 시 커리어 분석 상태 로드 (진행 중이면 폴링 시작)
  const careerLoadedRef = useRef(false)
  useEffect(() => {
    if (isNew || careerLoadedRef.current) return
    careerLoadedRef.current = true
    void (async () => {
      const outcome = await fetchCareer()
      if (outcome.kind === "ok" && outcome.data.inProgress) startCareerPoll()
    })()
    return () => stopCareerPoll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, resumeId])

  const startCareerAnalysis = async () => {
    if (isNew) return
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

  // ── 파일 업로드 핸들러 ──────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) setSelectedFile(file)
  }
  const handleUpload = async () => {
    if (!selectedFile) { toast.error("파일을 선택해주세요"); return }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim())
      const response = await fetch("/api/resumes/upload", {
        method: "POST", body: formData, credentials: "include",
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "업로드 실패")
      }
      const created = await response.json()
      toast.success("이력서가 업로드되었습니다. 내용을 확인하고 저장하세요.")
      setLocation(`/resumes/${created.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "업로드에 실패했습니다")
    } finally {
      setIsUploading(false)
    }
  }

  // ── AI 맞춤법 검사 ────────────────────────────────────────────────────────
  const runSpellcheck = async (values: ResumeFormValues): Promise<boolean> => {
    if (isNew) return true // 신규 등록 시 스킵
    setIsChecking(true)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/spellcheck`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:     values.content     || "",
          coverLetter: values.coverLetter || "",
        }),
      })
      if (!res.ok) throw new Error("맞춤법 검사 실패")
      const result: SpellcheckResult = await res.json()
      setSpellResult(result)
      if (result.corrections.length > 0) {
        setShowSpellDialog(true)
        return false // 저장 대기
      }
      return true
    } catch {
      // 오류 시 바로 저장 진행
      return true
    } finally {
      setIsChecking(false)
    }
  }

  // ── 저장 ─────────────────────────────────────────────────────────────────
  const doSave = (values: ResumeFormValues) => {
    const desiredSalaryNum = values.desiredSalary?.trim()
      ? parseInt(values.desiredSalary.replace(/[^0-9]/g, ""), 10) || null
      : null

    // HTML로 저장 (에디터 출력 그대로)
    const payload = {
      title:         values.title,
      content:       values.content       || "",
      coverLetter:   values.coverLetter   || "",
      desiredSalary: desiredSalaryNum ?? undefined,
    }

    if (isNew) {
      createResume.mutate({ data: payload }, {
        onSuccess: () => { toast.success("이력서가 등록되었습니다"); setLocation("/resumes") },
        onError:   () => toast.error("이력서 등록에 실패했습니다"),
      })
    } else {
      updateResume.mutate({ id: resumeId, data: payload }, {
        onSuccess: (updated) => {
          toast.success("이력서가 저장되었습니다")
          queryClient.setQueryData(getGetResumeQueryKey(resumeId), updated)
          setLocation("/resumes")
        },
        onError: () => toast.error("이력서 저장에 실패했습니다"),
      })
    }
  }

  const onSubmit = async (values: ResumeFormValues) => {
    const proceed = await runSpellcheck(values)
    if (proceed) doSave(values)
  }

  // 맞춤법 교정 후 수정 적용하고 저장
  const applyCorrectionsAndSave = () => {
    if (!spellResult) return
    const values = form.getValues()
    // 교정된 텍스트를 HTML로 변환해 에디터에 반영
    const correctedContent = spellResult.contentCorrected
      ? textToHtml(spellResult.contentCorrected)
      : values.content
    const correctedCoverLetter = spellResult.coverLetterCorrected
      ? textToHtml(spellResult.coverLetterCorrected)
      : values.coverLetter

    const correctedValues = {
      ...values,
      content:     correctedContent     || "",
      coverLetter: correctedCoverLetter || "",
    }
    form.reset(correctedValues)
    setShowSpellDialog(false)
    doSave(correctedValues)
  }

  // 교정 없이 원문 그대로 저장
  const saveWithoutCorrection = () => {
    setShowSpellDialog(false)
    doSave(form.getValues())
  }

  // ── PDF 다운로드 ─────────────────────────────────────────────────────────
  const handleDownloadPdf = () => {
    const values = form.getValues()
    const title  = values.title || resume?.title || "이력서"
    downloadPdf(title, values.content || "", values.coverLetter || "")
  }

  const isPending = createResume.isPending || updateResume.isPending

  // ── 로딩 스켈레톤 ─────────────────────────────────────────────────────────
  if (!isNew && isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // ── 편집 폼 ──────────────────────────────────────────────────────────────
  const EditForm = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* 제목 */}
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel>제목 / 이름</FormLabel>
            <FormControl>
              <Input placeholder="예: 프론트엔드 개발자 이력서" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* 희망 연봉 */}
        <FormField control={form.control} name="desiredSalary" render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-600" />
              희망 연봉 (만원)
            </FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type="number" min={0} step={100}
                  placeholder="예: 4500  (미기재 시 비워두세요)"
                  className="pr-14"
                  {...field}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                  만원
                </span>
              </div>
            </FormControl>
            <p className="text-xs text-slate-400">AI 서류 심사 시 예상 연봉과 비교·분석됩니다.</p>
            <FormMessage />
          </FormItem>
        )} />

        {/* 이력서 내용 — 리치 텍스트 에디터 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            이력서 내용
          </label>
          <Controller
            control={form.control}
            name="content"
            render={({ field }) => (
              <RichTextEditor
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="경력, 학력, 기술 스택 등을 입력하세요. 제목(H2/H3), 목록, 굵게 등 서식을 자유롭게 사용하세요."
                minHeight="18rem"
              />
            )}
          />
        </div>

        {/* 자기소개서 — 리치 텍스트 에디터 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            자기소개서
          </label>
          <Controller
            control={form.control}
            name="coverLetter"
            render={({ field }) => (
              <RichTextEditor
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="자기소개서 내용을 입력하세요. 지원동기, 성장과정, 장단점 등을 서식과 함께 작성해보세요."
                minHeight="14rem"
              />
            )}
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
          {/* PDF 다운로드 버튼 */}
          {!isNew && (
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <FileDown className="w-4 h-4" />
              PDF 다운로드
            </Button>
          )}

          <div className="flex gap-3 ml-auto">
            <Button type="button" variant="outline" onClick={() => setLocation("/resumes")}>
              취소
            </Button>
            <Button type="submit" disabled={isPending || isChecking}>
              {isChecking ? (
                <><SpellCheck className="w-4 h-4 mr-2 animate-pulse" />오탈자 검사 중…</>
              ) : isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />저장 중…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />저장</>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )

  // ── 커리어 분석 섹션 ───────────────────────────────────────────────────────
  const outlookBadge = (score: number) => {
    if (score >= 70) return { label: "전망 밝음", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
    if (score >= 40) return { label: "보통", cls: "bg-amber-100 text-amber-700 border-amber-200" }
    return { label: "주의", cls: "bg-red-100 text-red-700 border-red-200" }
  }

  const CareerAnalysisSection = () => {
    const result = career?.result ?? null
    const inProgress = career?.inProgress ?? false

    return (
      <Card className="border-slate-200">
        <CardHeader>
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
        <CardContent className="space-y-6">
          {/* 진행 중 */}
          {inProgress ? (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-6 flex flex-col items-center gap-3 text-sm text-indigo-700">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span>분석 중... 약 1~2분 소요</span>
            </div>
          ) : !result ? (
            /* 결과 없음 */
            <div className="space-y-4">
              <p className="text-sm text-slate-500 leading-relaxed">
                이력서만으로 강점과 NCS 기반 추천 직업, 미래 전망을 분석합니다.
              </p>
              {career?.error && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{career.error}</span>
                </div>
              )}
              <Button onClick={startCareerAnalysis} disabled={careerLoading} className="gap-2">
                {careerLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />시작 중…</>
                  : <><Sparkles className="w-4 h-4" />커리어 분석 시작</>}
              </Button>
            </div>
          ) : (
            /* 결과 표시 */
            <div className="space-y-7">
              {/* 강점 */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Award className="w-4 h-4 text-amber-500" />강점
                </h3>
                <ul className="space-y-2">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                      <div className="font-bold text-slate-800 text-sm">{s.title}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{s.evidence}</div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* NCS 직업군 */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Compass className="w-4 h-4 text-indigo-500" />NCS 직업군
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.ncsCategories.map((c, i) => (
                    <div key={i} className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[11px]">{c.major}</Badge>
                        {c.middle && (
                          <Badge variant="outline" className="text-[11px] border-indigo-200 text-indigo-700">
                            {c.middle}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{c.fitReason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추천 직업 */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />추천 직업
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {result.recommendedJobs.map((j, i) => {
                    const badge = outlookBadge(j.outlookScore)
                    return (
                      <div key={i} className="rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
                        <div>
                          <div className="font-bold text-slate-800">{j.job}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{j.ncsCategory}</div>
                        </div>

                        {/* 적합도 바 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>적합도</span>
                            <span className="font-semibold text-slate-700">{j.fitScore}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${j.fitScore}%` }}
                            />
                          </div>
                        </div>

                        <p className="text-sm text-slate-500 leading-relaxed">{j.reason}</p>

                        {/* 미래 전망 박스 */}
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-1.5 mt-auto">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5" />미래 전망
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>
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

              {/* 종합 조언 */}
              {result.summary && (
                <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-indigo-700 mb-1.5">
                    <Sparkles className="w-4 h-4" />종합 커리어 조언
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
                </div>
              )}

              {/* 다시 분석 */}
              <div className="pt-1">
                <Button
                  variant="outline"
                  onClick={startCareerAnalysis}
                  disabled={careerLoading}
                  className="gap-2"
                >
                  {careerLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />시작 중…</>
                    : <><RefreshCw className="w-4 h-4" />다시 분석</>}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 border-b pb-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/resumes")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isNew ? "새 이력서 등록" : "이력서 수정"}
          </h1>
        </div>

        {isNew ? (
          <Tabs defaultValue="upload">
            <TabsList className="mb-6">
              <TabsTrigger value="upload">파일 업로드</TabsTrigger>
              <TabsTrigger value="manual">직접 입력</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-5">
              <div
                className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-all"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-base font-semibold text-slate-700">PDF 또는 DOCX 파일을 업로드하세요</p>
                <p className="text-sm text-slate-400 mt-1">클릭하거나 여기에 드래그하세요</p>
                <p className="text-xs text-slate-300 mt-1">최대 10MB · PDF, DOC, DOCX 지원</p>
                <p className="text-xs text-slate-300 mt-1">스캔·이미지 PDF도 AI OCR로 지원합니다 (처리에 다소 시간이 걸릴 수 있습니다)</p>
                {selectedFile && (
                  <p className="mt-4 text-sm font-semibold text-primary">{selectedFile.name}</p>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx"
                className="hidden" onChange={handleFileSelect} />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">제목 (선택)</label>
                <Input
                  placeholder="비워두면 파일명이 자동 사용됩니다"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>

              {isUploading && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>파일을 분석하는 중입니다. 자기소개서를 자동으로 분리하고 표를 변환합니다…</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setLocation("/resumes")}>취소</Button>
                <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                  {isUploading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />분석 중…</>
                    : <><Upload className="w-4 h-4 mr-2" />업로드 및 분석</>}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual">{EditForm}</TabsContent>
          </Tabs>
        ) : EditForm}

        {/* ── 커리어 분석 ─────────────────────────────────────────────── */}
        {!isNew && <CareerAnalysisSection />}
      </div>

      {/* ── 맞춤법 검사 결과 다이얼로그 ────────────────────────────────── */}
      <Dialog open={showSpellDialog} onOpenChange={setShowSpellDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SpellCheck className="w-5 h-5 text-amber-500" />
              AI 오탈자·맞춤법 검사 결과
            </DialogTitle>
            <DialogDescription>
              저장 전 AI가 {spellResult?.corrections.length}개의 수정 사항을 발견했습니다.
              교정 내용을 적용하거나 원문 그대로 저장할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {spellResult?.corrections.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {c.field === "content" ? "이력서" : "자기소개서"}
                  </Badge>
                  <span className="text-xs text-slate-500">{c.reason}</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-red-600 line-through break-words">
                      <AlertTriangle className="w-3 h-3 inline mr-1 opacity-70" />
                      {c.original}
                    </div>
                    <div className="text-emerald-700 break-words mt-0.5">
                      <CheckCircle2 className="w-3 h-3 inline mr-1 opacity-70" />
                      {c.corrected}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={saveWithoutCorrection} className="sm:mr-auto">
              원문 그대로 저장
            </Button>
            <Button
              onClick={applyCorrectionsAndSave}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              교정 적용 후 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
