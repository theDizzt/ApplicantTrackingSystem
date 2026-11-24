import type { CameraPostureReport } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb, ScanFace } from "lucide-react"

const GAZE_LABEL: Record<CameraPostureReport["gazeLevel"], { label: string; className: string }> = {
  good: { label: "좋음", className: "text-emerald-600 dark:text-emerald-400" },
  fair: { label: "보통", className: "text-amber-600 dark:text-amber-400" },
  poor: { label: "부족", className: "text-red-600 dark:text-red-400" },
  unknown: { label: "측정 안 됨", className: "text-muted-foreground" },
}

const MOVEMENT_LABEL: Record<CameraPostureReport["movementLevel"], { label: string; className: string }> = {
  steady: { label: "안정적", className: "text-emerald-600 dark:text-emerald-400" },
  normal: { label: "보통", className: "text-muted-foreground" },
  restless: { label: "많음", className: "text-amber-600 dark:text-amber-400" },
  unknown: { label: "측정 안 됨", className: "text-muted-foreground" },
}

const pct = (value: number | null) => (value == null ? "—" : `${value}%`)

function Stat({ label, value, sub, subClassName }: { label: string; value: string; sub?: string; subClassName?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${subClassName ?? "text-muted-foreground"}`}>{sub}</div>}
    </div>
  )
}

/** 실시간 면접 카메라 자세·시선 분석 결과 */
export function CameraPostureCard({ report }: { report: CameraPostureReport }) {
  const gaze = GAZE_LABEL[report.gazeLevel]
  const movement = MOVEMENT_LABEL[report.movementLevel]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanFace className="w-5 h-5" /> 자세·시선 분석
        </CardTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          답변하는 동안 카메라로 잰 참고 지표입니다({report.analyzedCount}개 답변). 영상은 저장하지 않았고, 조명·안경·카메라 위치에 따라 정확도가 달라질 수 있습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="카메라를 바라본 시간" value={pct(report.gazeOnPercent)} sub={`시선 ${gaze.label}`} subClassName={gaze.className} />
          <Stat label="얼굴이 보인 시간" value={pct(report.faceVisiblePercent)} sub="80% 이상 권장" />
          <Stat label="고개를 돌린 시간" value={pct(report.lookAwayPercent)} sub={`숙이거나 든 시간 ${pct(report.headDownPercent)}`} />
          <Stat label="움직임" value={movement.label} sub={`고개 기울임 ${pct(report.tiltPercent)}`} subClassName={movement.className} />
        </div>

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
