import * as React from "react"
import { useLocation } from "wouter"
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"
import { Skeleton } from "@/components/ui/skeleton"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false
    }
  })
  const [, setLocation] = useLocation()

  React.useEffect(() => {
    if (isError) {
      setLocation("/login")
    }
  }, [isError, setLocation])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <div className="text-muted-foreground">Checking authentication...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
