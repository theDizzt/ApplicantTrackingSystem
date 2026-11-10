/**
 * 지원 일정 — 회사마다 저장한 서류 마감일·결과 발표일·면접일을 캘린더 이벤트로 바꾸고 D-day를 계산한다.
 * 날짜는 모두 "YYYY-MM-DD" 문자열(사용자 현지 날짜)로 다룬다.
 */
export const APPLICATION_STATUSES = ["관심", "지원 예정", "지원 완료", "서류 합격", "면접 진행", "최종 합격", "불합격"] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export type ScheduleKind = "deadline" | "announcement" | "interview"

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  deadline: "서류 마감",
  announcement: "결과 발표",
  interview: "면접",
}

export interface ScheduleCompany {
  id: number
  name: string
  applicationStatus?: string | null
  deadlineDate?: string | null
  announcementDate?: string | null
  interviewDate?: string | null
}

export interface ScheduleEvent {
  /** "companyId:kind:date" — 알림 중복 방지 키 (날짜를 바꾸면 다시 알린다) */
  key: string
  date: string
  kind: ScheduleKind
  companyId: number
  companyName: string
  status: string | null
}

const FIELD: Record<ScheduleKind, "deadlineDate" | "announcementDate" | "interviewDate"> = {
  deadline: "deadlineDate",
  announcement: "announcementDate",
  interview: "interviewDate",
}

/** 끝난 지원(최종 합격·불합격)의 남은 마감·면접은 알림 대상에서 뺀다. 발표일은 그대로 둔다. */
export function isClosed(status: string | null | undefined): boolean {
  return status === "최종 합격" || status === "불합격"
}

export function scheduleEvents(companies: ScheduleCompany[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = []
  for (const company of companies) {
    for (const kind of Object.keys(FIELD) as ScheduleKind[]) {
      const date = company[FIELD[kind]]
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      events.push({
        key: `${company.id}:${kind}:${date}`,
        date,
        kind,
        companyId: company.id,
        companyName: company.name,
        status: company.applicationStatus ?? null,
      })
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.companyName.localeCompare(b.companyName))
}

/** 현지 날짜를 "YYYY-MM-DD"로. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000)
}

/** 오늘 기준 남은 날 수 (오늘 0, 내일 1, 어제 -1). */
export function daysUntil(date: string, today: string): number {
  return dayNumber(date) - dayNumber(today)
}

/** "D-3", "D-DAY", "D+2" */
export function dDayLabel(date: string, today: string): string {
  const days = daysUntil(date, today)
  if (days === 0) return "D-DAY"
  return days > 0 ? `D-${days}` : `D+${-days}`
}

/**
 * 알림을 띄울 일정: 오늘부터 withinDays일 안. 끝난 지원의 마감·면접은 제외하고,
 * 결과 발표일은 상태와 관계없이 보여준다.
 */
export function upcomingEvents(events: ScheduleEvent[], today: string, withinDays = 3): ScheduleEvent[] {
  return events.filter((e) => {
    const days = daysUntil(e.date, today)
    if (days < 0 || days > withinDays) return false
    return e.kind === "announcement" || !isClosed(e.status)
  })
}

/** 달력 한 달 칸: 일요일 시작, 앞뒤 달 날짜로 채운 주 목록 (month는 0부터). */
export function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[][] {
  const first = new Date(year, month, 1)
  const cursor = new Date(year, month, 1 - first.getDay())
  const weeks: { date: string; inMonth: boolean }[][] = []
  do {
    const week: { date: string; inMonth: boolean }[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: toDateKey(cursor), inMonth: cursor.getMonth() === month })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getMonth() === month)
  return weeks
}
