import { useState } from "react"
import { Link, useLocation } from "wouter"
import { FileText, Building2, Users, CreditCard, LogOut, LayoutDashboard, BrainCircuit, Menu, Mic, CalendarDays, Award, ShieldCheck } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useScheduleAlerts } from "@/lib/schedule-alerts"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { data: user, isLoading } = useGetMe()
  const logout = useLogout()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // 3일 안의 마감·발표·면접: 메뉴 배지 (브라우저 알림은 켠 경우에만)
  const { upcoming } = useScheduleAlerts()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // 캐시를 즉시 제거 — 남아 있으면 /register 진입 시 stale user 데이터로 /dashboard redirect 발생
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() })
        setLocation("/")
      },
      onError: () => {
        toast.error("로그아웃에 실패했습니다")
      }
    })
  }

  const navItems = [
    { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
    { href: "/resumes", label: "내 이력서", icon: FileText },
    { href: "/profile", label: "이력 항목", icon: Award },
    { href: "/companies", label: "지원 회사", icon: Building2 },
    { href: "/schedule", label: "지원 일정", icon: CalendarDays, badge: upcoming.length },
    { href: "/analyses", label: "AI 서류 심사", icon: BrainCircuit },
    { href: "/interviews", label: "면접 연습", icon: Users },
    { href: "/cover-letter", label: "음성 자소서", icon: Mic },
    { href: "/subscription", label: "구독 관리", icon: CreditCard },
    // ADMIN_EMAILS에 등록된 계정에만 보인다
    ...((user as { isAdmin?: boolean } | undefined)?.isAdmin
      ? [{ href: "/admin", label: "관리자", icon: ShieldCheck }]
      : []),
  ]

  const sidebarContent = (
    <>
      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {"badge" in item && item.badge ? (
                <span
                  className={cn(
                    "ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5",
                    isActive ? "bg-primary-foreground text-primary" : "bg-rose-500 text-white",
                  )}
                  aria-label={`3일 안의 일정 ${item.badge}개`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>

      {/* User + logout */}
      <div className="p-4 border-t space-y-3">
        <div className="text-sm">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ) : user ? (
            <div>
              <div className="font-semibold text-foreground">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              <div className="mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                  {user.subscriptionStatus.toUpperCase()}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <Button variant="outline" className="w-full justify-start text-muted-foreground text-sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </>
  )

  // 모바일 하단 탭: 자주 쓰는 4개 + 전체 메뉴
  const tabItems = [
    { href: "/dashboard", label: "홈", icon: LayoutDashboard },
    { href: "/resumes", label: "이력서", icon: FileText },
    { href: "/companies", label: "지원 회사", icon: Building2 },
    { href: "/analyses", label: "AI 심사", icon: BrainCircuit },
  ]
  const tabActive = tabItems.some(t => location.startsWith(t.href))
  const currentLabel = navItems.find(n => location.startsWith(n.href))?.label ?? "My ATS"

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">

      {/* ── 모바일 상단 바 ── */}
      <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 border-b bg-card/95 backdrop-blur">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <img src="/logo.png" alt="My ATS" className="h-7 w-auto shrink-0" />
          <span className="truncate text-sm font-bold text-slate-800">{currentLabel}</span>
        </Link>
        <button
          className="relative -mr-1.5 flex h-10 w-10 items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
          onClick={() => setMobileNavOpen(true)}
          aria-label={upcoming.length ? `메뉴 열기 (3일 안의 일정 ${upcoming.length}개)` : "메뉴 열기"}
        >
          <Menu className="w-5 h-5" />
          {upcoming.length > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </button>
      </header>

      {/* ── 모바일 전체 메뉴 (오른쪽에서 열림) ── */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="right" className="md:hidden flex w-[82vw] max-w-xs flex-col gap-0 p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetHeader className="h-14 flex-row items-center gap-2.5 space-y-0 border-b px-4 text-left">
            <img src="/logo.png" alt="" className="h-7 w-auto" />
            <SheetTitle className="text-sm font-bold">My ATS</SheetTitle>
            <SheetDescription className="sr-only">전체 메뉴</SheetDescription>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* ── 모바일 하단 탭 바 ── */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="주요 메뉴"
      >
        <div className="grid grid-cols-5">
          {tabItems.map((item) => {
            const Icon = item.icon
            const isActive = location.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
                {item.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              !tabActive ? "text-primary" : "text-muted-foreground",
            )}
            aria-label={upcoming.length ? `전체 메뉴 (3일 안의 일정 ${upcoming.length}개)` : "전체 메뉴"}
          >
            <Menu className="h-5 w-5" />
            전체
            {upcoming.length > 0 && (
              <span className="absolute top-2.5 left-1/2 ml-2 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {upcoming.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ── 데스크톱 사이드바 ── */}
      <aside className="hidden md:flex md:w-64 border-r bg-card flex-col md:fixed md:h-screen z-10 shrink-0">
        {/* Logo */}
        <Link href="/" className="p-4 border-b flex items-center gap-3 hover:bg-slate-50 transition-colors">
          <img src="/logo.png" alt="My ATS" className="h-8 w-auto" />
          <div className="leading-none">
            <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">My ATS</div>
            <div className="text-sm font-bold text-slate-800 tracking-tight">Applicant Tracking System</div>
          </div>
        </Link>
        {sidebarContent}
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      {/* 모바일: 하단 탭 바(4rem + 안전 영역)에 내용이 가리지 않게 여백 */}
      <main className="flex-1 min-w-0 md:ml-64 p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-8 animate-in fade-in duration-300 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
