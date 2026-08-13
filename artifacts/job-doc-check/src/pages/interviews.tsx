import { useListInterviews } from "@workspace/api-client-react"
import { Link } from "wouter"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Building2, Plus, FileText } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

const statusKorean: Record<string, string> = {
  pending: "생성 중",
  questions_generated: "질문 생성 완료",
  answers_submitted: "답변 제출됨",
  evaluated: "평가 완료",
}

export default function InterviewsPage() {
  const { data: interviews, isLoading } = useListInterviews()

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">면접 연습</h1>
          <p className="text-muted-foreground mt-1">이력서 기반 AI 면접 질문을 연습하세요.</p>
        </div>
        <Link href="/interviews/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> 연습 시작
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : interviews?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">면접 연습 내역이 없습니다</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
              이력서의 취약점을 분석해 실전 면접 질문을 생성합니다.
            </p>
            <Link href="/interviews/new" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
              첫 면접 연습 시작
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interviews?.map(interview => (
            <Link key={interview.id} href={`/interviews/${interview.id}`} className="block">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-6 flex flex-col h-full justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <Building2 className="w-4 h-4 text-primary" />
                        {interview.companyName || "회사 미등록"}
                      </div>
                      <Badge variant={interview.status === 'evaluated' ? 'success' : 'secondary'} className="text-[10px]">
                        {statusKorean[interview.status] || interview.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      {interview.resumeTitle || "제목 없음"}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(interview.createdAt), 'yyyy.MM.dd')}
                    </div>
                    {interview.status === 'evaluated' && interview.overallScore && (
                      <div className="font-mono font-bold">
                        점수: {interview.overallScore}/100
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
