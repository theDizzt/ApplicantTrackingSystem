import { useListSubscriptionPlans, useGetMySubscription, useSubscribe, useCancelSubscription, getGetMySubscriptionQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function SubscriptionPage() {
  const { data: plans } = useListSubscriptionPlans()
  const { data: sub } = useGetMySubscription()
  const subscribe = useSubscribe()
  const cancel = useCancelSubscription()
  const queryClient = useQueryClient()

  const handleSubscribe = (planId: string) => {
    subscribe.mutate({ data: { planId } }, {
      onSuccess: () => {
        toast.success("구독이 완료되었습니다")
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() })
      },
      onError: () => {
        toast.error("구독에 실패했습니다")
      }
    })
  }

  const handleCancel = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.success("구독이 해지되었습니다")
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() })
      },
      onError: () => {
        toast.error("구독 해지에 실패했습니다")
      }
    })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">구독 관리</h1>
        <p className="text-muted-foreground mt-1">플랜과 사용량을 관리하세요.</p>
      </div>

      {sub && (
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider mb-1">현재 플랜</div>
              <div className="text-3xl font-bold capitalize flex items-center gap-3">
                {sub.status}
                {sub.status === 'cancelled' && <Badge variant="destructive">종료 예정</Badge>}
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm font-medium">
                <div className="bg-background/20 px-3 py-1.5 rounded-md">
                  심사 사용량: {sub.analysesUsed} / {sub.analysesLimit === -1 ? '무제한' : sub.analysesLimit}
                </div>
              </div>
            </div>
            
            {sub.status !== 'free' && sub.status !== 'cancelled' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground">
                    구독 해지
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>구독을 해지하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                      청구 주기 종료 시 프리미엄 기능 이용이 불가능해집니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>유지하기</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      네, 해지합니다
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6 pt-4">
        {plans?.map(plan => {
          const isCurrent = sub?.planId === plan.id || (sub?.status === 'free' && plan.name.toLowerCase() === 'free')
          
          return (
            <Card key={plan.id} className={`flex flex-col relative ${isCurrent ? 'border-primary shadow-md ring-1 ring-primary' : ''}`}>
              {isCurrent && (
                <div className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-sm">
                  현재 플랜
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="text-3xl font-bold my-2">
                  ₩{plan.price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/월</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{plan.analysesPerMonth === -1 ? '무제한' : plan.analysesPerMonth} 심사 횟수/월</span>
                  </li>
                  {plan.features?.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || subscribe.isPending}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isCurrent ? "현재 플랜" : "업그레이드"}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
