import type { SpeechCount, SpeechHabitReport } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb, MessageSquareQuote } from "lucide-react"

const PACE_LABEL: Record<SpeechHabitReport["paceLevel"], { label: string; className: string }> = {
  slow: { label: "느린 편", className: "text-amber-600 dark:text-amber-400" },
  normal: { label: "적당함", className: "text-emerald-600 dark:text-emerald-400" },
  fast: { label: "빠른 편", className: "text-amber-600 dark:text-amber-400" },
  unknown: { label: "측정 안 됨", className: "text-muted-foreground" },
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return "—"
  const s = Math.round(seconds)
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`
}

function Stat({ label, value, sub, subClassName }: { label: string; value: string; sub?: string; subClassName?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${subClassName ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  )
}

function Chips({ title, description, items }: { title: string; description: string; items: SpeechCount[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">· {description}</span></div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item.word} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs">
            <span className="font-medium">{item.word}</span>
            <span className="text-muted-foreground tabular-nums">×{item.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** 실시간(음성) 면접 말버릇 분석 결과 */
export function SpeechHabitsCard({ report }: { report: SpeechHabitReport }) {
  const pace = PACE_LABEL[report.paceLevel]
  const noHabits = report.fillers.length === 0 && report.habitWords.length === 0 && report.habitPhrases.length === 0 && report.repeatedWords.length === 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareQuote className="w-5 h-5" /> 말버릇 분석
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          녹음 길이와 받아 적은 답변으로 계산한 참고 지표입니다. 음성 인식이 '음·어' 같은 소리를 빼고 적는 경우가 있어 실제보다 적게 셀 수 있습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="말 속도"
            value={report.syllablesPerMinute != null ? `${report.syllablesPerMinute}` : "—"}
            sub={report.syllablesPerMinute != null ? `분당 음절 · ${pace.label}` : pace.label}
            subClassName={pace.className}
          />
          <Stat
            label="음·어 같은 소리"
            value={`${report.fillerCount}회`}
            sub={report.fillersPerMinute != null ? `1분에 약 ${report.fillersPerMinute}번` : undefined}
          />
          <Stat label="평균 답변 길이" value={formatSeconds(report.averageAnswerSeconds)} sub="30초~1분 30초 권장" />
          <Stat label="답한 질문" value={`${report.answeredCount}개`} sub={`총 ${formatSeconds(report.totalSeconds)}`} />
        </div>

        {noHabits ? (
          <p className="text-sm text-muted-foreground">눈에 띄게 반복한 군말이나 표현이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <Chips title="간투사" description="말이 막힐 때 내는 소리" items={report.fillers} />
            <Chips title="습관어" description="뜻 없이 자주 끼워 넣은 말" items={report.habitWords} />
            <Chips title="습관 표현" description="반복한 말투" items={report.habitPhrases} />
            <Chips title="반복 단어" description="질문에 없는데 여러 번 쓴 단어" items={report.repeatedWords} />
          </div>
        )}

        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
          <div className="text-sm font-semibold flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-primary" />연습 포인트</div>
          <ul className="space-y-1.5 text-sm leading-relaxed list-disc pl-5">
            {report.tips.map(tip => <li key={tip}>{tip}</li>)}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
