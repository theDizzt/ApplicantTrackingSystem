import { cn } from "@/lib/utils"

/**
 * 근거 자료 없이 AI가 모델 지식으로 만든 값(연봉 범위, 직업 전망 등)에 붙이는 표시.
 * GROUNDING_TODO 2번 단기 대책: 공공 통계를 붙이기 전까지 출처가 없다는 것을 알린다.
 */
export const AI_ESTIMATE_TITLE =
  "공공 통계 같은 근거 자료 없이 AI가 추정한 값입니다. 실제 채용 조건은 회사·공고마다 다를 수 있으니 참고용으로만 보세요."

export function AiEstimateBadge({ label = "AI 추정치 · 출처 없음", className }: { label?: string; className?: string }) {
  return (
    <span
      title={AI_ESTIMATE_TITLE}
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-500 whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  )
}

export function AiEstimateNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] text-slate-400 leading-relaxed", className)}>
      ※ {AI_ESTIMATE_TITLE}
    </p>
  )
}
