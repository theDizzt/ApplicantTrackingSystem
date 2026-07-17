import { useState, useEffect } from "react"
import { useParams, Link } from "wouter"
import { useGetInterview, useSubmitAnswers, useEvaluateAnswers, getGetInterviewQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, BrainCircuit, CheckCircle2 } from "lucide-react"

export default function InterviewDetail() {
  const params = useParams()
  const interviewId = parseInt(params.id!, 10)
  const queryClient = useQueryClient()
  
  const { data: interview, isLoading } = useGetInterview(interviewId, {
    query: { queryKey: getGetInterviewQueryKey(interviewId), enabled: !!interviewId, refetchInterval: (query) => { const s = query?.state?.data?.status; return s === "pending" || s === "answers_submitted" ? 3000 : false } }
  })

  const submitAnswers = useSubmitAnswers()
  const evaluateAnswers = useEvaluateAnswers()

  const [answers, setAnswers] = useState<Record<number, string>>({})

  useEffect(() => {
    if (interview?.questions && interview.status === "questions_generated") {
      const initial: Record<number, string> = {}
      interview.questions.forEach(q => {
        if (q.answer) initial[q.id] = q.answer
      })
      if (Object.keys(initial).length > 0 && Object.keys(answers).length === 0) {
        setAnswers(initial)
      }
    }
  }, [interview, answers])

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = () => {
    if (!interview?.questions) return

    const formattedAnswers = interview.questions.map(q => ({
      questionId: q.id,
      answer: answers[q.id] || ""
    })).filter(a => a.answer.trim().length > 0)

    if (formattedAnswers.length !== interview.questions.length) {
      toast.error("모든 질문에 답변을 입력해주세요")
      return
    }

    submitAnswers.mutate({ id: interviewId, data: { answers: formattedAnswers } }, {
      onSuccess: () => {
        toast.success("답변이 제출되었습니다. 평가를 시작합니다...")
        evaluateAnswers.mutate({ id: interviewId }, {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetInterviewQueryKey(interviewId), data)
          }
        })
      },
      onError: () => {
        toast.error("답변 제출에 실패했습니다")
      }
    })
  }

  if (isLoading || !interview) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const isGenerating = interview.status === "pending"
  const isEvaluating = interview.status === "answers_submitted"
  const isCompleted = interview.status === "evaluated"
  
  if (isGenerating) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h3 className="text-xl font-semibold">맞춤형 면접 질문 생성 중</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          AI가 이력서를 분석해 취약점과 핵심 항목을 도출하고 있습니다.
        </p>
      </div>
    )
  }

  if (isEvaluating) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center animate-in fade-in">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h3 className="text-xl font-semibold">답변 평가 중</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          답변의 명확성, 논리적 구조, 기업 적합성을 채점하고 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link 
          href="/interviews" 
          className="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            면접 연습
            {isCompleted && <Badge variant="success">평가 완료</Badge>}
          </h1>
          <p className="text-muted-foreground mt-1">
            {interview.companyName} • {interview.resumeTitle}
          </p>
        </div>
        {isCompleted && interview.overallScore && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">종합 점수</div>
            <div className="text-4xl font-bold font-mono text-primary">
              {interview.overallScore}<span className="text-xl text-muted-foreground font-sans">/100</span>
            </div>
          </div>
        )}
      </div>

      {isCompleted && interview.overallFeedback && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BrainCircuit className="w-5 h-5" /> 종합 피드백
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{interview.overallFeedback}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {interview.questions?.sort((a,b) => a.order - b.order).map((q, idx) => (
          <Card key={q.id} className={isCompleted ? (q.score && q.score >= 70 ? "border-success/50" : "border-warning/50") : ""}>
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b pb-4">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-base leading-relaxed flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                    Q{idx + 1}
                  </span>
                  {q.question}
                </CardTitle>
                {isCompleted && q.score !== undefined && q.score !== null && (
                  <Badge variant={q.score >= 70 ? "success" : "warning"} className="font-mono text-sm px-2">
                    {q.score}/100
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {isCompleted ? (
                <>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">나의 답변</div>
                    <div className="text-sm p-4 bg-slate-50 dark:bg-slate-900 rounded-md whitespace-pre-wrap">
                      {q.answer}
                    </div>
                  </div>
                  {q.feedback && (
                    <div className="pt-4 border-t">
                      <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> AI 피드백
                      </div>
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {q.feedback}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Textarea 
                  placeholder="답변을 입력하세요..."
                  className="min-h-[120px] text-sm"
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!isCompleted && (
        <div className="flex justify-end pt-4 border-t">
          <Button size="lg" onClick={handleSubmit} disabled={submitAnswers.isPending}>
            답변 제출 및 평가 받기
          </Button>
        </div>
      )}
    </div>
  )
}
