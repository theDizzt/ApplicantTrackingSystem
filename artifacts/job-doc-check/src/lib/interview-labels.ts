import type { FollowUpTone, InterviewDifficulty } from "@workspace/api-client-react"

export const DIFFICULTY_OPTIONS: { value: InterviewDifficulty; label: string; title: string; description: string }[] = [
  { value: "easy", label: "하", title: "하 · 기본 질문", description: "지원 동기, 경험 소개처럼 준비하면 답할 수 있는 질문. 꼬리 질문은 질문당 1번, 압박 없이 진행합니다." },
  { value: "normal", label: "중", title: "중 · 실전", description: "경험 검증과 직무 역량 질문을 섞은 실제 면접 수준. 답변이 약하면 압박, 좋으면 한 단계 더 깊게 묻습니다." },
  { value: "hard", label: "상", title: "상 · 압박 면접", description: "약점·공백을 정면으로 짚고 반박하는 압박 질문이 나옵니다. 엄격하게 채점하고 꼬리 질문도 더 많이 이어집니다." },
]

export function difficultyLabel(difficulty: InterviewDifficulty | undefined): string {
  return DIFFICULTY_OPTIONS.find(option => option.value === (difficulty ?? "normal"))?.label ?? "중"
}

export const TONE_LABEL: Record<FollowUpTone, { label: string; className: string }> = {
  pressure: { label: "압박", className: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900" },
  neutral: { label: "확인", className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" },
  positive: { label: "긍정", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900" },
}
