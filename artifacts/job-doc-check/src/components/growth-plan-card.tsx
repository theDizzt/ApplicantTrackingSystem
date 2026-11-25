import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { getGetAnalysisQueryKey } from "@workspace/api-client-react"
import { toast } from "sonner"
import { CalendarCheck, Clock, Flag, Loader2, Quote as QuoteIcon, RotateCcw, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ── 타입 (서버 artifacts/api-server/src/lib/growth-plan.ts 와 같은 모양) ──────
export type LearnerStage = "student" | "senior" | "graduate"

export interface GrowthPlan {
  stage: LearnerStage
  weeklyHours: number
  createdAt: string
  items: {
    title: string
    quote: string
    quoteVerified: boolean
    whyHelpful: string
    totalWeeks: number
    hoursPerWeek: number
    weeklyTasks: { week: number; task: string; deliverable: string }[]
    completionCriteria: string
  }[]
}

const STAGES: { value: LearnerStage; label: string; hint: string }[] = [
  { value: "student",  label: "1~3학년",       hint: "학기 중 병행, 다음 지원 시즌 준비" },
  { value: "senior",   label: "4학년·졸업 예정", hint: "지원 시즌 직전, 있는 경험을 증빙" },
  { value: "graduate", label: "졸업 후 구직 중", hint: "공백 기간을 설명할 결과물" },
]
const STAGE_LABEL: Record<LearnerStage, string> = { student: "1~3학년", senior: "4학년·졸업 예정", graduate: "졸업 후 구직 중" }
const HOUR_OPTIONS = [2, 4, 6, 8, 10, 15, 20]

const DISCLAIMER =
  "지금 바로 시작해 1~2개월 안에 마칠 수 있는 활동만 제안합니다. 서류에 드러나지 않았다고 실제 역량이 부족하다는 뜻은 아니며, 타고난 능력에 대한 평가가 아닙니다."

function PlanSetupForm({
  analysisId, initialStage, initialHours, onDone, onCancel,
}: {
  analysisId: number
  initialStage?: LearnerStage
  initialHours?: number
  onDone: () => void
  onCancel?: () => void
}) {
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<LearnerStage | null>(initialStage ?? null)
  const [hours, setHours] = useState(initialHours ?? 6)

  const create = useMutation({
    mutationFn: async (): Promise<GrowthPlan> => {
      const res = await fetch(`/api/analyses/${analysisId}/growth-plan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, weeklyHours: hours }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "계획을 만들지 못했습니다.")
      return body.growthPlan as GrowthPlan
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetAnalysisQueryKey(analysisId) })
      toast.success("취업 역량 강화 계획을 만들었습니다.")
      onDone()
    },
    onError: (err) => {
      toast.error("오류", { description: err instanceof Error ? err.message : "계획을 만들지 못했습니다." })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-slate-700 mb-2">지금 나의 단계</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {STAGES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStage(s.value)}
              aria-pressed={stage === s.value}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                stage === s.value ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500" : "border-slate-200 bg-white hover:bg-slate-50",
              )}
            >
              <span className="block text-sm font-bold text-slate-800">{s.label}</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-700 mb-2">일주일에 쓸 수 있는 시간</p>
        <div className="flex flex-wrap gap-1.5">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              aria-pressed={hours === h}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                hours === h ? "border-teal-500 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              주 {h}시간
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => create.mutate()} disabled={!stage || create.isPending} className="gap-2">
          {create.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />계획을 만드는 중…</> : <><CalendarCheck className="w-4 h-4" />계획 만들기</>}
        </Button>
        {onCancel && !create.isPending && <Button variant="ghost" onClick={onCancel}>취소</Button>}
      </div>
      {create.isPending && <p className="text-xs text-slate-500">AI가 계획을 만드는 데 1분 정도 걸릴 수 있습니다.</p>}
    </div>
  )
}

function PlanDetails({ plan }: { plan: GrowthPlan }) {
  return (
    <ol className="space-y-5 pt-2">
      {plan.items.map((p, i) => (
        <li key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">{i + 1}</span>
            <p className="text-sm font-bold text-slate-900">{p.title}</p>
            {p.quoteVerified && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-200">이력서 원문</span>
            )}
          </div>
          {p.quote && (
            <blockquote className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <QuoteIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span className="break-words">{p.quote}</span>
              {!p.quoteVerified && (
                <span className="ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-semibold bg-slate-200 text-slate-500"
                  title="AI가 인용한 문장이 이력서·자기소개서 원문에서 그대로 확인되지 않았습니다">원문 미확인</span>
              )}
            </blockquote>
          )}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-0.5">이 활동이 도움이 되는 이유</p>
            <p className="text-sm text-slate-600 leading-relaxed">{p.whyHelpful}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800"><CalendarCheck className="w-3.5 h-3.5" />총 {p.totalWeeks}주</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800"><Clock className="w-3.5 h-3.5" />주 {p.hoursPerWeek}시간</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700 mb-1.5">주차별 과제</p>
            <ol className="space-y-1.5">
              {p.weeklyTasks.map((t) => (
                <li key={t.week} className="flex gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="w-12 shrink-0 text-xs font-bold text-teal-700">{t.week}주차</span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">{t.task}</p>
                    {t.deliverable && <p className="text-xs text-slate-500 mt-0.5"><b className="font-semibold">결과물</b> · {t.deliverable}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg bg-emerald-50/70 px-3 py-2">
            <p className="text-xs font-bold text-emerald-800 mb-0.5 flex items-center gap-1"><Flag className="w-3.5 h-3.5" />완료 기준</p>
            <p className="text-sm text-emerald-900 leading-relaxed">{p.completionCriteria}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function GrowthPlanCard({ analysisId, plan }: { analysisId: number; plan?: GrowthPlan }) {
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const hasPlan = !!plan && plan.items.length > 0

  const weekRange = hasPlan
    ? (() => {
        const ws = plan.items.map((p) => p.totalWeeks)
        const min = Math.min(...ws), max = Math.max(...ws)
        return min === max ? `${min}주` : `${min}~${max}주`
      })()
    : ""

  return (
    <Card className="rounded-2xl border border-teal-100 shadow-sm bg-gradient-to-br from-teal-50/40 to-white">
      <CardHeader className="pb-2 pt-5 px-6">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Target className="w-4 h-4 text-teal-600" />
          {hasPlan ? `바로 시작할 수 있는 단기 계획 ${plan.items.length}개 · ${weekRange}` : "취업 역량 강화 계획"}
        </CardTitle>
        <p className="text-xs text-slate-500 leading-relaxed mt-1">{DISCLAIMER}</p>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        {!hasPlan || editing ? (
          <>
            {!hasPlan && (
              <p className="text-sm text-slate-600 leading-relaxed">
                이 심사에서 부족했던 요건과 보완점을 바탕으로 4~8주 계획을 만듭니다. 지금 단계와 쓸 수 있는 시간을 고르면 거기에 맞춰 만듭니다.
              </p>
            )}
            <PlanSetupForm
              analysisId={analysisId}
              initialStage={plan?.stage}
              initialHours={plan?.weeklyHours}
              onDone={() => setEditing(false)}
              onCancel={hasPlan ? () => setEditing(false) : undefined}
            />
          </>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {plan.items.map((p, i) => (
                <li key={i} className="rounded-full border border-teal-100 bg-white px-3 py-1 text-xs font-medium text-teal-800">
                  {p.title} · {p.totalWeeks}주
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-400">{STAGE_LABEL[plan.stage]} · 주 {plan.weeklyHours}시간 기준</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Dialog open={open} onOpenChange={setOpen}>
                <Button variant="outline" onClick={() => setOpen(true)} className="flex-1 gap-2">
                  세부 분석 보기 <Target className="w-4 h-4" />
                </Button>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Target className="w-5 h-5 text-teal-600" />취업 역량 강화 계획</DialogTitle>
                    <DialogDescription>{STAGE_LABEL[plan.stage]} · 주 {plan.weeklyHours}시간 기준. {DISCLAIMER}</DialogDescription>
                  </DialogHeader>
                  <PlanDetails plan={plan} />
                </DialogContent>
              </Dialog>
              <Button variant="ghost" onClick={() => setEditing(true)} className="gap-2 text-slate-600">
                <RotateCcw className="w-4 h-4" />조건 바꿔 다시 만들기
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
