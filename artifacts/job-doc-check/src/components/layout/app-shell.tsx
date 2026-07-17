import { Link, useLocation } from "wouter"
import { FileText, Building2, BrainCircuit, Users, CreditCard, LogOut, LayoutDashboard } from "lucide-react"
import { useGetMe, useLogout } from "@workspace/api-client-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { data: user, isLoading } = useGetMe()
  const logout = useLogout()
  const [, setLocation] = useLocation()

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/")
      },
      onError: () => {
        toast.error("Logout failed")
      }
    })
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/resumes", label: "My Resumes", icon: FileText },
    { href: "/companies", label: "Target Companies", icon: Building2 },
    { href: "/analyses", label: "AI Analysis", icon: BrainCircuit },
    { href: "/interviews", label: "Interview Prep", icon: Users },
    { href: "/subscription", label: "Subscription", icon: CreditCard },
  ]

  return (
    <div className="flex min-h-screen w-full bg-background flex-col md:flex-row">
      <aside className="md:w-64 border-r bg-card flex flex-col md:fixed md:h-screen z-10 w-full shrink-0">
        <div className="p-4 border-b flex items-center gap-2 font-bold text-lg text-primary bg-card">
          <BrainCircuit className="w-6 h-6" />
          AI 서류 심사관
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.startsWith(item.href)
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t space-y-4">
          <div className="text-sm">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            ) : user ? (
              <div>
                <div className="font-medium text-foreground">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {user.subscriptionStatus.toUpperCase()} PLAN
                  </span>
                </div>
              </div>
            ) : null}
          </div>
          
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-6 md:p-8 animate-in fade-in duration-300 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
