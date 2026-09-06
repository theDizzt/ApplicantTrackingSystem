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
  ChevronLeft, Save, Upload, Loader2, Banknote, FileDown,
  CheckCircle2, AlertTriangle, SpellCheck, Sparkles, Info, FileText, PenLine, BarChart, History, Activity, Settings
} from "lucide-react"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"

import { RichTextEditor } from "@/components/rich-text-editor"
import { ResumePrintDialog } from "@/components/resume-print"

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
interface CareerNcsCategory { major: string; middle: string; level?: number; fitReason: string }
interface CareerRecommendedJob {
  job: string
  ncsCategory: string
  fitScore: number
  reason: string
  outlook: string
  outlookScore: number
  salaryGuide?: CareerSalaryGuide
}
interface CareerSalaryGuide { min: number; max: number; basis: string }
interface CareerTypoIssue { found: string; suggestion: string; note: string }
interface CareerDateIssue { found: string; issue: string; suggestion: string }
interface CareerAnalysisResult {
  strengths: CareerStrength[]
  ncsCategories: CareerNcsCategory[]
  recommendedJobs: CareerRecommendedJob[]
  summary: string
  resumeSummary?: string
  salaryGuide?: CareerSalaryGuide
  typoIssues?: CareerTypoIssue[]
  dateIssues?: CareerDateIssue[]
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

  // PDF 다운로드(템플릿 선택) 다이얼로그
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  // 커리어 분석 상태
  const [career, setCareer] = useState<CareerAnalysisState | null>(null)
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
    const hasContent =
      htmlToText(values.content || "").length > 0 ||
      htmlToText(values.coverLetter || "").length > 0
    if (!hasContent) {
      toast.error("다운로드할 이력서 내용이 없습니다.")
      return
    }
    setShowPrintDialog(true)
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


  // ── 렌더링 ──────────────────────────────────────────────────────────────
  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 정보 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        {/* 이력서 내용 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <FileText className="w-4 h-4 text-blue-600" />
              이력서 내용
            </CardTitle>
            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
              {htmlToText(form.watch("content") || "").length}자
            </div>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="content"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="경력, 학력, 기술 스택 등을 입력하세요. 제목(H2/H3), 목록, 굵게 등 서식을 자유롭게 사용하세요."
                  minHeight="24rem"
                />
              )}
            />
          </CardContent>
        </Card>

        {/* 자기소개서 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <PenLine className="w-4 h-4 text-blue-600" />
              자기소개서
            </CardTitle>
            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
              {htmlToText(form.watch("coverLetter") || "").length}자
            </div>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="coverLetter"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="자기소개서 내용을 입력하세요. 지원동기, 성장과정, 장단점 등을 서식과 함께 작성해보세요."
                  minHeight="18rem"
                />
              )}
            />
          </CardContent>
        </Card>

        <button id="hidden-submit-btn" type="submit" className="hidden" />
      </form>
    </Form>
  )

  return (
    <>
      <div className="animate-in fade-in duration-500 pb-20">
        {/* 상단 고정 액션 바 */}
        <div className="sticky top-0 z-50 -mx-4 px-4 sm:-mx-6 sm:px-6 py-4 bg-white/85 backdrop-blur-md border-b border-slate-200 flex items-center justify-between gap-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/resumes")} className="shrink-0 -ml-2 text-slate-500 hover:text-slate-900">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate text-slate-900">
              {isNew ? "새 이력서 등록" : "이력서 수정"}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => setLocation("/resumes")} className="hidden sm:inline-flex border-slate-200 text-slate-700 hover:bg-slate-50">
              취소
            </Button>
            <Button 
              type="button" 
              disabled={isPending || isChecking} 
              onClick={() => document.getElementById('hidden-submit-btn')?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isChecking ? (
                <><SpellCheck className="w-4 h-4 sm:mr-2 animate-pulse" /><span className="hidden sm:inline">오탈자 검사 중…</span></>
              ) : isPending ? (
                <><Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /><span className="hidden sm:inline">저장 중…</span></>
              ) : (
                <><Save className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">저장</span></>
              )}
            </Button>
          </div>
        </div>

        <div className={`grid gap-6 items-start ${!isNew ? "lg:grid-cols-[1fr_300px]" : "max-w-4xl"}`}>
          {/* Main Form Area */}
          <div className="space-y-8 min-w-0">
            {isNew ? (
              <Tabs defaultValue="upload">
                <TabsList className="mb-6 w-full max-w-sm grid grid-cols-2">
                  <TabsTrigger value="upload">파일 업로드</TabsTrigger>
                  <TabsTrigger value="manual">직접 입력</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-5">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all bg-white"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <Upload className="w-12 h-12 text-blue-500/50 mx-auto mb-4" />
                    <p className="text-base font-semibold text-slate-800">PDF 또는 DOCX 파일을 업로드하세요</p>
                    <p className="text-sm text-slate-500 mt-1">클릭하거나 여기에 드래그하세요</p>
                    <p className="text-xs text-slate-400 mt-2">최대 10MB · PDF, DOC, DOCX 지원</p>
                    <p className="text-xs text-slate-400 mt-1">스캔·이미지 PDF도 AI OCR로 지원합니다 (처리에 다소 시간이 걸릴 수 있습니다)</p>
                    {selectedFile && (
                      <p className="mt-4 text-sm font-semibold text-blue-600 bg-blue-50 py-1.5 px-3 rounded-full inline-block">{selectedFile.name}</p>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx"
                    className="hidden" onChange={handleFileSelect} />

                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-800">제목 (선택)</label>
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

                      <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                          {isUploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />분석 중…</>
                          ) : (
                            <><Upload className="w-4 h-4" />업로드 및 분석</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manual">{formContent}</TabsContent>
              </Tabs>
            ) : formContent}
          </div>

          {/* Sidebar Area (Only if !isNew) */}
          {!isNew && (
            <div className="space-y-4">
              {/* AI 요약 카드 */}
              {career?.result?.resumeSummary && (
                <Card className="border-indigo-100 bg-indigo-50/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      AI 요약
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {career.result.resumeSummary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 문서 정보 카드 */}
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3 border-b border-slate-100/60 mb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-slate-500" />
                    문서 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">이력서 분량</span>
                    <span className="font-medium text-slate-700">{htmlToText(form.watch("content") || "").length}자</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">자소서 분량</span>
                    <span className="font-medium text-slate-700">{htmlToText(form.watch("coverLetter") || "").length}자</span>
                  </div>
                  
                  {resume?.createdAt && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />생성일
                      </span>
                      <span className="text-slate-600 text-[11px] font-medium">
                        {new Date(resume.createdAt).toLocaleString("ko-KR", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />커리어 분석
                    </span>
                    <span className="text-xs font-medium">
                      {career?.inProgress ? <span className="text-indigo-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />분석 중</span>
                        : career?.error ? <span className="text-red-600">오류 발생</span>
                        : career?.result ? <span className="text-emerald-600">완료됨</span>
                        : <span className="text-slate-400">대기 중</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* 액션 카드 */}
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3 border-b border-slate-100/60 mb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-500" />
                    추가 작업
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPdf}
                    className="w-full gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm"
                    disabled={(htmlToText(form.watch("content") || "").length === 0 && htmlToText(form.watch("coverLetter") || "").length === 0)}
                  >
                    <FileDown className="w-4 h-4" />
                    이력서 PDF 다운로드
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── PDF 다운로드: 템플릿 선택 + 인쇄 뷰 ────────────────────────── */}
      <ResumePrintDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        data={{
          title:       form.getValues("title") || resume?.title || "이력서",
          content:     form.getValues("content") || "",
          coverLetter: form.getValues("coverLetter") || "",
          aiSummary:   career?.result?.resumeSummary ?? null,
        }}
      />

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
