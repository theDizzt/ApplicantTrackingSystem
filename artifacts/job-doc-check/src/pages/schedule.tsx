import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useListCompanies } from "@workspace/api-client-react"
import { Bell, BellOff, CalendarDays, ChevronLeft, ChevronRight, Building2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  dDayLabel, daysUntil, isClosed, monthGrid, scheduleEvents, SCHEDULE_KIND_LABEL, toDateKey,
  type ScheduleEvent, type ScheduleKind,
} from "@/lib/schedule"
import {
  ALERT_DAYS, disableNotifications, enableNotifications, notificationsEnabled, notificationsSupported,
} from "@/lib/schedule-alerts"

const KIND_STYLE: Record<ScheduleKind, string> = {
  deadline: "bg-rose-100 text-rose-700 border-rose-200",
  announcement: "bg-emerald-100 text-emerald-700 border-emerald-200",
  interview: "bg-sky-100 text-sky-700 border-sky-200",
}
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function EventChip({ event, compact }: { event: ScheduleEvent; compact?: boolean }) {
  return (
    <Link
      href={`/companies/${event.companyId}`}
      className={cn(
        "block truncate rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight hover:opacity-80",
        KIND_STYLE[event.kind],
        isClosed(event.status) && event.kind !== "announcement" && "opacity-50 line-through",
      )}
      title={`${event.companyName} · ${SCHEDULE_KIND_LABEL[event.kind]}`}
    >
      {compact ? event.companyName : `${SCHEDULE_KIND_LABEL[event.kind]} · ${event.companyName}`}
    </Link>
  )
}

export default function SchedulePage() {
  const { data: companies, isLoading } = useListCompanies()
  const today = toDateKey(new Date())
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() } })
  const [notify, setNotify] = useState(() => notificationsEnabled())

  const events = useMemo(() => scheduleEvents(companies ?? []), [companies])
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])
  const weeks = monthGrid(cursor.year, cursor.month)
  const upcoming = events.filter((e) => daysUntil(e.date, today) >= 0).slice(0, 12)
  const undated = (companies ?? []).filter((c) => !c.deadlineDate && !c.announcementDate && !c.interviewDate)

  const move = (delta: number) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const toggleNotify = async () => {
    if (notify) { disableNotifications(); setNotify(false); toast.success("브라우저 알림을 껐습니다"); return }
    if (await enableNotifications()) { setNotify(true); toast.success(`일정 ${ALERT_DAYS}일 전부터 브라우저 알림을 보냅니다`) }
    else toast.error("브라우저 알림 권한이 없습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.")
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">지원 일정</h1>
          <p className="text-muted-foreground mt-1">
            회사별 서류 마감일·결과 발표일·면접일을 한눈에 봅니다. 날짜는 지원 회사 정보에서 입력합니다.
          </p>
        </div>
        {notificationsSupported() && (
          <Button variant={notify ? "secondary" : "outline"} onClick={toggleNotify} data-testid="button-toggle-notify">
            {notify ? <BellOff className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
            {notify ? "브라우저 알림 끄기" : "브라우저 알림 켜기"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* ── 달력 ── */}
          <Card>
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="이전 달"><ChevronLeft className="w-5 h-5" /></Button>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold" data-testid="text-month">{cursor.year}년 {cursor.month + 1}월</span>
                  <Button variant="outline" size="sm" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }) }}>오늘</Button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="다음 달"><ChevronRight className="w-5 h-5" /></Button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b pb-1">
                {WEEKDAYS.map((w, i) => <div key={w} className={cn(i === 0 && "text-rose-500", i === 6 && "text-sky-600")}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {weeks.flat().map(({ date, inMonth }) => {
                  const dayEvents = byDate.get(date) ?? []
                  return (
                    <div
                      key={date}
                      className={cn(
                        "min-h-[64px] sm:min-h-[92px] border-b border-r p-1 space-y-0.5 overflow-hidden",
                        !inMonth && "bg-slate-50/70 text-muted-foreground/60",
                      )}
                      data-testid={`day-${date}`}
                    >
                      <div className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        date === today && "bg-primary text-primary-foreground",
                      )}>
                        {Number(date.slice(8))}
                      </div>
                      {/* 좁은 화면에서는 점으로, 넓으면 이름으로 */}
                      <div className="hidden sm:block space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => <EventChip key={e.key} event={e} compact />)}
                        {dayEvents.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</div>}
                      </div>
                      <div className="flex sm:hidden flex-wrap gap-0.5">
                        {dayEvents.map((e) => (
                          <span key={e.key} className={cn("w-1.5 h-1.5 rounded-full border", KIND_STYLE[e.kind])} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                {(Object.keys(SCHEDULE_KIND_LABEL) as ScheduleKind[]).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className={cn("w-2.5 h-2.5 rounded-sm border", KIND_STYLE[k])} />{SCHEDULE_KIND_LABEL[k]}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── 다가오는 일정 ── */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-3">
                <p className="font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />다가오는 일정</p>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">예정된 일정이 없습니다.</p>
                ) : (
                  <ul className="space-y-2" data-testid="list-upcoming">
                    {upcoming.map((e) => {
                      const days = daysUntil(e.date, today)
                      return (
                        <li key={e.key}>
                          <Link href={`/companies/${e.companyId}`} className="flex items-center justify-between gap-2 rounded-lg border p-2.5 hover:border-primary/50">
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{e.companyName}</div>
                              <div className="text-xs text-muted-foreground">{SCHEDULE_KIND_LABEL[e.kind]} · {e.date.replace(/-/g, ".")}</div>
                            </div>
                            <span className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                              days <= ALERT_DAYS ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600",
                            )}>{dDayLabel(e.date, today)}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
            {undated.length > 0 && (
              <Card>
                <CardContent className="p-5 space-y-2">
                  <p className="font-semibold text-sm">날짜가 없는 회사 {undated.length}곳</p>
                  <ul className="space-y-1">
                    {undated.slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <Link href={`/companies/${c.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <Building2 className="w-3.5 h-3.5" />{c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
