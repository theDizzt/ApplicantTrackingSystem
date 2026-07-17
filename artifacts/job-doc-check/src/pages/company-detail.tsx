import { useEffect, useRef } from "react"
import { useLocation, useParams } from "wouter"
import { useForm } from "react-hook-form"
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

const companySchema = z.object({
  name: z.string().min(1, "회사명을 입력해주세요"),
  siteUrl: z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  jobPostingUrl: z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  talentProfile: z.string().optional(),
  jobDescription: z.string().optional(),
  notes: z.string().optional()
})

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
  
  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      siteUrl: "",
      jobPostingUrl: "",
      talentProfile: "",
      jobDescription: "",
      notes: ""
    }
  })

  const initializedRef = useRef(false)
  
  useEffect(() => {
    if (company && !initializedRef.current) {
      form.reset({
        name: company.name || "",
        siteUrl: company.siteUrl || "",
        jobPostingUrl: company.jobPostingUrl || "",
        talentProfile: company.talentProfile || "",
        jobDescription: company.jobDescription || "",
        notes: company.notes || ""
      })
      initializedRef.current = true
    }
  }, [company, form])

  const onSubmit = (values: z.infer<typeof companySchema>) => {
    if (isNew) {
      createCompany.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("회사가 등록되었습니다")
          setLocation("/companies")
        },
        onError: () => {
          toast.error("회사 등록에 실패했습니다")
        }
      })
    } else {
      updateCompany.mutate({ id: companyId, data: values }, {
        onSuccess: (updated) => {
          toast.success("회사 정보가 수정되었습니다")
          queryClient.setQueryData(getGetCompanyQueryKey(companyId), updated)
        },
        onError: () => {
          toast.error("회사 정보 수정에 실패했습니다")
        }
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
          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>회사명</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 토스, 네이버, 카카오..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="siteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회사 홈페이지</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="jobPostingUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>채용공고 URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="talentProfile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>인재상</FormLabel>
                <FormDescription>
                  회사의 인재상이나 핵심 가치를 붙여넣으세요.
                </FormDescription>
                <FormControl>
                  <Textarea className="h-32 resize-none" placeholder="예: 고객 중심, 자기 주도적 문제 해결..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="jobDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>채용공고 내용 (JD)</FormLabel>
                <FormDescription>
                  담당 업무와 자격 요건을 붙여넣으세요. 직무 적합도 채점에 핵심적으로 사용됩니다.
                </FormDescription>
                <FormControl>
                  <Textarea className="h-48 resize-none font-mono text-sm" placeholder="JD 전문을 붙여넣으세요..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>메모</FormLabel>
                <FormControl>
                  <Textarea className="h-20" placeholder="지원 일정, 담당 리크루터 등 개인 메모..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => setLocation("/companies")}>
              취소
            </Button>
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
