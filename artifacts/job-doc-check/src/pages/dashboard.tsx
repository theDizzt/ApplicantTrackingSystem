import { useGetDashboard } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BrainCircuit, Building2, FileText, CheckCircle2, Clock, Users } from "lucide-react"
import { Link } from "wouter"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard()

  if (isLoading || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Skeleton className="col-span-4 h-96 rounded-xl" />
          <Skeleton className="col-span-3 h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">등록 이력서</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalResumes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">지원 회사</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalCompanies}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">심사 횟수</CardTitle>
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.totalAnalyses}</div>
            <p className="text-xs text-muted-foreground mt-1">
              평균 점수: {dashboard.averageScore ? Math.round(dashboard.averageScore) : '--'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">합격률</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.totalAnalyses > 0 
                ? Math.round((dashboard.passedAnalyses / dashboard.totalAnalyses) * 100) 
                : 0}%
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="text-success">{dashboard.passedAnalyses} 합격</span>
              <span>•</span>
              <span className="text-destructive">{dashboard.failedAnalyses} 불합격</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>최근 심사</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentAnalyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                심사 내역이 없습니다. <Link href="/analyses/new" className="text-primary hover:underline">지금 시작하세요.</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentAnalyses.map(analysis => (
                  <Link key={analysis.id} href={`/analyses/${analysis.id}`} className="block border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">{analysis.resumeTitle}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {analysis.companyName}
                        </div>
                      </div>
                      <div>
                        {analysis.status === "completed" && analysis.overallResult === "pass" && (
                          <Badge variant="success">합격</Badge>
                        )}
                        {analysis.status === "completed" && analysis.overallResult === "fail" && (
                          <Badge variant="destructive">불합격</Badge>
                        )}
                        {analysis.status !== "completed" && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 분석 중
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>최근 면접</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentInterviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                면접 내역이 없습니다. <Link href="/interviews/new" className="text-primary hover:underline">지금 시작하세요.</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentInterviews.map(interview => (
                  <Link key={interview.id} href={`/interviews/${interview.id}`} className="block border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          {interview.companyName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          점수: {interview.overallScore || '--'}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {interview.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
