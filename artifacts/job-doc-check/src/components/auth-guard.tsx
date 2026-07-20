import * as React from "react"
import { useLocation } from "wouter"
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  })
  const [, navigate] = useLocation()

  // 단 한 번만 /login으로 이동하도록 ref로 guard
  const redirectedRef = React.useRef(false)

  React.useEffect(() => {
    if (isError && !redirectedRef.current) {
      redirectedRef.current = true
      navigate("/login")
    }
  }, [isError, navigate])

  // isError가 해소되면 다시 이동 가능하도록 reset
  React.useEffect(() => {
    if (!isError) redirectedRef.current = false
  }, [isError])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <div className="text-muted-foreground">인증 확인 중…</div>
        </div>
      </div>
    )
  }

  if (!user) return null
  return <>{children}</>
}
