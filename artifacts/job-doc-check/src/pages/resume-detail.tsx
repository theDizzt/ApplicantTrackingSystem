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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, Save, Upload, FileText } from "lucide-react"

const resumeSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  content: z.string().optional(),
  coverLetter: z.string().optional(),
})

export default function ResumeDetail() {
  const params = useParams()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()

  const isNew = !params.id || params.id === "new"
  const resumeId = isNew ? 0 : parseInt(params.id!, 10)

  const { data: resume, isLoading } = useGetResume(resumeId, {
    query: { enabled: !isNew, queryKey: getGetResumeQueryKey(resumeId) }
  })

  const createResume = useCreateResume()
  const updateResume = useUpdateResume()

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState("")
  const [isUploading, setIsUploading] = useState(false)

  const form = useForm<z.infer<typeof resumeSchema>>({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      title: "",
      content: "",
      coverLetter: "",
    }
  })

  const initializedRef = useRef(false)

  useEffect(() => {
    if (resume && !initializedRef.current) {
      form.reset({
        title: resume.title || "",
        content: resume.content || "",
        coverLetter: resume.coverLetter || ""
      })
      initializedRef.current = true
    }
  }, [resume, form])

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
    if (!selectedFile) {
      toast.error("파일을 선택해주세요")
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim())
      const response = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "업로드 실패")
      }
      toast.success("이력서가 업로드되었습니다")
      setLocation("/resumes")
    } catch (err: any) {
      toast.error(err.message || "업로드에 실패했습니다")
    } finally {
      setIsUploading(false)
    }
  }

  const onSubmit = (values: z.infer<typeof resumeSchema>) => {
    if (isNew) {
      createResume.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("이력서가 등록되었습니다")
          setLocation("/resumes")
        },
        onError: () => {
          toast.error("이력서 등록에 실패했습니다")
        }
      })
    } else {
      updateResume.mutate({ id: resumeId, data: values }, {
        onSuccess: (updated) => {
          toast.success("이력서가 수정되었습니다")
          queryClient.setQueryData(getGetResumeQueryKey(resumeId), updated)
          setLocation("/resumes")
        },
        onError: () => {
          toast.error("이력서 수정에 실패했습니다")
        }
      })
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="space-y-8 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  const isPending = createResume.isPending || updateResume.isPending

  const ManualForm = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>제목 / 이름</FormLabel>
              <FormControl>
                <Input placeholder="예: 프론트엔드 개발자 이력서" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이력서 내용</FormLabel>
              <FormControl>
                <Textarea className="h-72 resize-y font-mono text-sm" placeholder="경력, 학력, 기술 스택..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="coverLetter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>자기소개서</FormLabel>
              <FormControl>
                <Textarea className="h-64 resize-y font-mono text-sm" placeholder="자기소개서 내용을 입력하세요..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => setLocation("/resumes")}>
            취소
          </Button>
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
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/resumes")}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isNew ? "새 이력서 등록" : "이력서 수정"}
          </h1>
        </div>
      </div>

      {isNew ? (
        <Tabs defaultValue="upload">
          <TabsList className="mb-6">
            <TabsTrigger value="upload">파일 업로드</TabsTrigger>
            <TabsTrigger value="manual">직접 입력</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <div
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">PDF 또는 DOCX 파일을 업로드하세요</p>
              <p className="text-sm text-muted-foreground mt-2">클릭하거나 파일을 여기에 드래그하세요</p>
              <p className="text-xs text-muted-foreground mt-1">최대 10MB · PDF, DOC, DOCX 지원</p>
              {selectedFile && (
                <p className="mt-4 text-sm font-medium text-primary">선택된 파일: {selectedFile.name}</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">제목 (선택)</label>
              <Input
                placeholder="파일명이 자동으로 채워집니다"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setLocation("/resumes")}>
                취소
              </Button>
              <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? "업로드 중..." : "파일 업로드 및 이력서 생성"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="manual">
            {ManualForm}
          </TabsContent>
        </Tabs>
      ) : (
        ManualForm
      )}
    </div>
  )
}
