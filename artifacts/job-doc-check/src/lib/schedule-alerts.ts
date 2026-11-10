import { useEffect, useMemo, useState } from "react"
import { useListCompanies } from "@workspace/api-client-react"
import { dDayLabel, scheduleEvents, SCHEDULE_KIND_LABEL, toDateKey, upcomingEvents, type ScheduleEvent } from "./schedule"

/**
 * 다가오는 지원 일정(오늘~3일 뒤) 알림.
 *   - 화면 안: 메뉴 배지·대시보드 카드가 upcoming을 쓴다.
 *   - 브라우저 알림: 사용자가 켠 경우에만, 일정마다 하루 한 번 띄운다 (앱을 열어 둔 동안).
 * 설정과 "이미 알린 일정"은 이 브라우저의 localStorage에만 둔다.
 */
const ENABLED_KEY = "ats.scheduleNotify"
const SENT_KEY = "ats.scheduleNotified"
export const ALERT_DAYS = 3

function read(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}
function write(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* 저장소를 못 쓰는 환경에서는 매번 알릴 수 있음 */ }
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function notificationsEnabled(): boolean {
  return notificationsSupported() && Notification.permission === "granted" && read(ENABLED_KEY) === "1"
}

/** 브라우저 알림을 켠다 (권한 요청 포함). 켜졌으면 true. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission()
  if (permission !== "granted") return false
  write(ENABLED_KEY, "1")
  return true
}

export function disableNotifications(): void {
  write(ENABLED_KEY, "0")
}

export function alertText(event: ScheduleEvent, today: string): string {
  return `${event.companyName} ${SCHEDULE_KIND_LABEL[event.kind]} ${dDayLabel(event.date, today)}`
}

/** 앱 셸에서 한 번 부른다: 다가오는 일정 목록을 돌려주고, 켜져 있으면 브라우저 알림을 보낸다. */
export function useScheduleAlerts(): { upcoming: ScheduleEvent[]; today: string } {
  const { data: companies } = useListCompanies()
  // 자정을 넘겨 열어 둔 화면도 날짜가 바뀌도록 10분마다 다시 계산한다.
  const [today, setToday] = useState(() => toDateKey(new Date()))
  useEffect(() => {
    const timer = window.setInterval(() => setToday(toDateKey(new Date())), 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const upcoming = useMemo(
    () => upcomingEvents(scheduleEvents(companies ?? []), today, ALERT_DAYS),
    [companies, today],
  )

  useEffect(() => {
    if (upcoming.length === 0 || !notificationsEnabled()) return
    let sent: Record<string, string> = {}
    try { sent = JSON.parse(read(SENT_KEY) ?? "{}") as Record<string, string> } catch { sent = {} }
    let changed = false
    for (const event of upcoming) {
      if (sent[event.key] === today) continue
      try {
        new Notification("My ATS 지원 일정", { body: alertText(event, today), tag: event.key })
      } catch { continue }
      sent[event.key] = today
      changed = true
    }
    if (!changed) return
    // 지난 일정의 기록은 지운다.
    for (const key of Object.keys(sent)) if (!upcoming.some((e) => e.key === key)) delete sent[key]
    write(SENT_KEY, JSON.stringify(sent))
  }, [upcoming, today])

  return { upcoming, today }
}
