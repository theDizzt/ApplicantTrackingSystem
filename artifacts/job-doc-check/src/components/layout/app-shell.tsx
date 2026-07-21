import { useState } from "react"
import { Link, useLocation } from "wouter"
import { FileText, Building2, Users, CreditCard, LogOut, LayoutDashboard, BrainCircuit, Menu, X } from "lucide-react"
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { data: user, isLoading } = useGetMe()
  const logout = useLogout()
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

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
    { href: "/companies", label: "지원 회사", icon: Building2 },
    { href: "/analyses", label: "AI 서류 심사", icon: BrainCircuit },
    { href: "/interviews", label: "면접 연습", icon: Users },
    { href: "/subscription", label: "구독 관리", icon: CreditCard },
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

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">

      {/* ── 모바일 상단 바 ── */}
      <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b bg-card">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="My ATS" className="h-7 w-auto" />
          <span className="text-sm font-bold text-slate-800">My ATS</span>
        </Link>
        <button
          className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          onClick={() => setMobileNavOpen(v => !v)}
          aria-label="메뉴 열기"
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── 모바일 드롭다운 메뉴 ── */}
      {mobileNavOpen && (
        <div className="md:hidden border-b bg-card flex flex-col z-10">
          {sidebarContent}
        </div>
      )}

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
      <main className="flex-1 md:ml-64 p-4 md:p-8 animate-in fade-in duration-300 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
