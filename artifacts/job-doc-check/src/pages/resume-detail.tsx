import { useEffect, useRef, useState } from "react"
import { useLocation, useParams } from "wouter"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useCreateResume, useUpdateResume, useGetResume, getGetResumeQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, Save, Upload, Eye, Pencil, Loader2 } from "lucide-react"

// ── 마크다운 테이블 렌더러 ──────────────────────────────────────────────────
// 마크다운 | col | col | 문법을 HTML <table>로 렌더링합니다.
function MarkdownContent({ text }: { text: string }) {
  const blocks = splitToBlocks(text)
  return (
    <div className="text-sm leading-relaxed space-y-3 font-mono whitespace-pre-wrap break-words">
      {blocks.map((block, i) =>
        block.type === "table" ? (
          <div key={i} className="overflow-x-auto my-2 not-prose">
            <table className="w-full border-collapse text-sm">
              {block.rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? "bg-slate-100 font-semibold" : "even:bg-slate-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-slate-200 px-3 py-1.5 align-top whitespace-pre-wrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
        ) : (
          <span key={i}>{block.text}</span>
        )
      )}
    </div>
  )
}

type TextBlock = { type: "text"; text: string }
type TableBlock = { type: "table"; rows: string[][] }
type Block = TextBlock | TableBlock

function splitToBlocks(text: string): Block[] {
  const lines = text.split("\n")
  const blocks: Block[] = []
  let textBuf: string[] = []
  let tableBuf: string[][] = []
  let inTable = false

  const flushText = () => {
    if (textBuf.length) {
      blocks.push({ type: "text", text: textBuf.join("\n") })
      textBuf = []
    }
  }
  const flushTable = () => {
    if (tableBuf.length) {
      // remove separator rows (---|---) and empty rows
      const rows = tableBuf.filter(r => !r.every(c => /^[-: ]+$/.test(c)))
      if (rows.length) blocks.push({ type: "table", rows })
      tableBuf = []
    }
    inTable = false
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1)
    if (isTableRow) {
      if (!inTable) { flushText(); inTable = true }
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim())
      tableBuf.push(cells)
    } else {
      if (inTable) flushTable()
      textBuf.push(line)
    }
  }
  if (inTable) flushTable()
  flushText()
  return blocks
}

// ── 폼 스키마 ──────────────────────────────────────────────────────────────
const resumeSchema = z.object({
  title:       z.string().min(1, "제목을 입력해주세요"),
  content:     z.string().optional(),
  coverLetter: z.string().optional(),
})

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function ResumeDetail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const isNew = !params.id || params.id === "new"
  const resumeId = isNew ? 0 : parseInt(params.id!, 10)

  const { data: resume, isLoading } = useGetResume(resumeId, {
    query: { enabled: !isNew, queryKey: getGetResumeQueryKey(resumeId) },
  })

  const createResume = useCreateResume()
  const updateResume = useUpdateResume()

  // 파일 업로드 상태
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile]   = useState<File | null>(null)
  const [uploadTitle,  setUploadTitle]    = useState("")
  const [isUploading,  setIsUploading]    = useState(false)

  // 미리보기 탭 상태 (이력서 내용 / 자기소개서)
  const [contentView,     setContentView]     = useState<"edit" | "preview">("edit")
  const [coverLetterView, setCoverLetterView] = useState<"edit" | "preview">("edit")

  const form = useForm<z.infer<typeof resumeSchema>>({
    resolver: zodResolver(resumeSchema),
    defaultValues: { title: "", content: "", coverLetter: "" },
  })

  const initializedRef = useRef(false)
  useEffect(() => {
    if (resume && !initializedRef.current) {
      form.reset({
        title:       resume.title       || "",
        content:     resume.content     || "",
        coverLetter: resume.coverLetter || "",
      })
      initializedRef.current = true
    }
  }, [resume, form])

  // ── 파일 업로드 핸들러 ──
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
      // 업로드 후 수정 화면으로 이동하여 분리 결과를 바로 확인
      setLocation(`/resumes/${created.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "업로드에 실패했습니다"
      toast.error(msg)
    } finally {
      setIsUploading(false)
    }
  }

  // ── 저장 핸들러 ──
  const onSubmit = (values: z.infer<typeof resumeSchema>) => {
    if (isNew) {
      createResume.mutate({ data: values }, {
        onSuccess: () => { toast.success("이력서가 등록되었습니다"); setLocation("/resumes") },
        onError:   () => toast.error("이력서 등록에 실패했습니다"),
      })
    } else {
      updateResume.mutate({ id: resumeId, data: values }, {
        onSuccess: (updated) => {
          toast.success("이력서가 수정되었습니다")
          queryClient.setQueryData(getGetResumeQueryKey(resumeId), updated)
          setLocation("/resumes")
        },
        onError: () => toast.error("이력서 수정에 실패했습니다"),
      })
    }
  }

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

  const isPending = createResume.isPending || updateResume.isPending
  const contentValue     = form.watch("content")     ?? ""
  const coverLetterValue = form.watch("coverLetter") ?? ""
  const hasTable = (t: string) => t.includes("|")

  // ── 편집 폼 (직접 입력 & 기존 수정) ──
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

        {/* 이력서 내용 */}
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel className="mb-0">이력서 내용</FormLabel>
              {hasTable(contentValue) && (
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button type="button"
                    onClick={() => setContentView("edit")}
                    className={`px-3 py-1 flex items-center gap-1 transition-colors ${contentView === "edit" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50 text-slate-600"}`}>
                    <Pencil className="w-3 h-3" />편집
                  </button>
                  <button type="button"
                    onClick={() => setContentView("preview")}
                    className={`px-3 py-1 flex items-center gap-1 transition-colors ${contentView === "preview" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50 text-slate-600"}`}>
                    <Eye className="w-3 h-3" />미리보기
                  </button>
                </div>
              )}
            </div>
            <FormControl>
              {contentView === "edit" || !hasTable(contentValue) ? (
                <Textarea className="h-72 resize-y font-mono text-sm" placeholder="경력, 학력, 기술 스택..." {...field} />
              ) : (
                <div className="min-h-72 max-h-[32rem] overflow-y-auto rounded-md border border-input bg-white px-3 py-2">
                  <MarkdownContent text={contentValue} />
                </div>
              )}
            </FormControl>
            {hasTable(contentValue) && contentView === "edit" && (
              <p className="text-xs text-slate-400 mt-1">표 데이터가 감지되었습니다. 미리보기 탭에서 렌더링된 표를 확인하세요.</p>
            )}
            <FormMessage />
          </FormItem>
        )} />

        {/* 자기소개서 */}
        <FormField control={form.control} name="coverLetter" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between mb-1.5">
              <FormLabel className="mb-0">자기소개서</FormLabel>
              {coverLetterValue.trim() && (
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button type="button"
                    onClick={() => setCoverLetterView("edit")}
                    className={`px-3 py-1 flex items-center gap-1 transition-colors ${coverLetterView === "edit" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50 text-slate-600"}`}>
                    <Pencil className="w-3 h-3" />편집
                  </button>
                  <button type="button"
                    onClick={() => setCoverLetterView("preview")}
                    className={`px-3 py-1 flex items-center gap-1 transition-colors ${coverLetterView === "preview" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50 text-slate-600"}`}>
                    <Eye className="w-3 h-3" />미리보기
                  </button>
                </div>
              )}
            </div>
            <FormControl>
              {coverLetterView === "edit" ? (
                <Textarea className="h-64 resize-y font-mono text-sm" placeholder="자기소개서 내용을 입력하세요..." {...field} />
              ) : (
                <div className="min-h-64 max-h-[40rem] overflow-y-auto rounded-md border border-input bg-white px-3 py-2">
                  <MarkdownContent text={coverLetterValue} />
                </div>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => setLocation("/resumes")}>취소</Button>
          <Button type="submit" disabled={isPending}>
            <Save className="w-4 h-4 mr-2" />
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </Form>
  )

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      {/* 헤더 */}
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

          {/* 파일 업로드 탭 */}
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
              {selectedFile && (
                <p className="mt-4 text-sm font-semibold text-primary">{selectedFile.name}</p>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx"
              className="hidden" onChange={handleFileSelect} />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">제목 (선택)</label>
              <Input placeholder="비워두면 파일명이 자동 사용됩니다"
                value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
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
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />분석 중…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />업로드 및 분석</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* 직접 입력 탭 */}
          <TabsContent value="manual">{EditForm}</TabsContent>
        </Tabs>
      ) : (
        EditForm
      )}
    </div>
  )
}
