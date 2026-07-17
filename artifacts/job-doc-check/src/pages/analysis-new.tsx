import { useState } from "react"
import { useLocation } from "wouter"
import { useListResumes, useListCompanies, useCreateAnalysis } from "@workspace/api-client-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Building2, BrainCircuit } from "lucide-react"

export default function NewAnalysisPage() {
  const [, setLocation] = useLocation()
  const { data: resumes } = useListResumes()
  const { data: companies } = useListCompanies()
  const createAnalysis = useCreateAnalysis()

  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)

  const handleSubmit = () => {
    if (!selectedResumeId || !selectedCompanyId) {
      toast.error("이력서와 회사를 모두 선택해주세요")
      return
    }

    createAnalysis.mutate({
      data: {
        resumeId: selectedResumeId,
        companyId: selectedCompanyId
      }
    }, {
      onSuccess: (data) => {
        toast.success("심사가 시작되었습니다")
        setLocation(`/analyses/${data.id}`)
      },
      onError: () => {
        toast.error("심사 시작에 실패했습니다")
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI 서류 심사 시작</h1>
        <p className="text-muted-foreground mt-1">심사할 이력서와 지원 회사를 선택하세요.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            1. 이력서 선택
          </h2>
          <div className="space-y-3">
            {resumes?.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                등록된 이력서가 없습니다. 먼저 이력서를 등록해주세요.
              </div>
            )}
            {resumes?.map(resume => (
              <div 
                key={resume.id}
                onClick={() => setSelectedResumeId(resume.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selectedResumeId === resume.id 
                    ? 'border-primary ring-1 ring-primary bg-primary/5' 
                    : 'hover:border-slate-300 dark:hover:border-slate-700 bg-card'
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
            {companies?.length === 0 && (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                등록된 회사가 없습니다. 먼저 회사를 등록해주세요.
              </div>
            )}
            {companies?.map(company => (
              <div 
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                  selectedCompanyId === company.id 
                    ? 'border-primary ring-1 ring-primary bg-primary/5' 
                    : 'hover:border-slate-300 dark:hover:border-slate-700 bg-card'
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
          disabled={!selectedResumeId || !selectedCompanyId || createAnalysis.isPending}
          className="w-full md:w-auto"
        >
          <BrainCircuit className="w-5 h-5 mr-2" />
          {createAnalysis.isPending ? "심사 시작 중..." : "AI 심사 시작"}
        </Button>
      </div>
    </div>
  )
}
