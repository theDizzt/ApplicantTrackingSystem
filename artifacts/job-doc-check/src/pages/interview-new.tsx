import { useState } from "react"
import { useLocation } from "wouter"
import { useListResumes, useListCompanies, useCreateInterview } from "@workspace/api-client-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FileText, Building2, Users } from "lucide-react"

export default function NewInterviewPage() {
  const [, setLocation] = useLocation()
  const { data: resumes } = useListResumes()
  const { data: companies } = useListCompanies()
  const createInterview = useCreateInterview()

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  const handleSubmit = () => {
    if (!selectedResumeId || !selectedCompanyId) {
      toast.error("이력서와 회사를 모두 선택해주세요")
      return
    }

    createInterview.mutate({
      data: {
        resumeId: selectedResumeId,
        companyId: selectedCompanyId
      }
    }, {
      onSuccess: (data) => {
        toast.success("면접 세션이 생성되었습니다")
        setLocation(`/interviews/${data.id}`)
      },
      onError: () => {
        toast.error("면접 세션 시작에 실패했습니다")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">면접 연습 시작</h1>
        <p className="text-muted-foreground mt-1">면접 질문의 기반이 될 이력서와 회사를 선택하세요.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            1. 이력서 선택
          </h2>
          <div className="space-y-3">
            {resumes?.map(resume => (
              <div 
                key={resume.id}
                onClick={() => setSelectedResumeId(resume.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selectedResumeId === resume.id 
                    ? 'border-primary ring-1 ring-primary bg-primary/5' 
                    : 'hover:border-slate-300 bg-card'
                }`}
              >
                <div className="font-medium">{resume.title}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            2. 지원 회사 선택
          </h2>
          <div className="space-y-3">
            {companies?.map(company => (
              <div 
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selectedCompanyId === company.id 
                    ? 'border-primary ring-1 ring-primary bg-primary/5' 
                    : 'hover:border-slate-300 bg-card'
                }`}
              >
                <div className="font-medium">{company.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-8 border-t flex justify-end">
        <Button 
          size="lg" 
          onClick={handleSubmit} 
          disabled={!selectedResumeId || !selectedCompanyId || createInterview.isPending}
          className="w-full md:w-auto"
        >
          <Users className="w-5 h-5 mr-2" />
          {createInterview.isPending ? "질문 생성 중..." : "면접 질문 생성"}
        </Button>
      </div>
    </div>
  )
}
