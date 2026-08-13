import { useListSubscriptionPlans, useGetMySubscription, useSubscribe, useCancelSubscription, getGetMySubscriptionQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

export default function SubscriptionPage() {
  const { data: plans } = useListSubscriptionPlans()
  const { data: sub } = useGetMySubscription()
  const subscribe = useSubscribe()
  const cancel = useCancelSubscription()
  const queryClient = useQueryClient()

  const handleSubscribe = (planId: string) => {
    subscribe.mutate({ data: { planId } }, { onSuccess: () => { toast.success("구독이 완료되었습니다"); queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() }) }, onError: () => toast.error("구독에 실패했습니다") })
  }
  const handleCancel = () => {
    cancel.mutate(undefined, { onSuccess: () => { toast.success("구독이 해지되었습니다"); queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() }) }, onError: () => toast.error("구독 해지에 실패했습니다") })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
      <div><h1 className="text-3xl font-bold tracking-tight">구독 관리</h1><p className="text-muted-foreground mt-1">필요한 만큼, 더 깊이 이력서를 분석하세요.</p></div>
      {sub && <Card className="bg-primary text-primary-foreground border-none"><CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6"><div><div className="text-sm font-medium text-primary-foreground/80 uppercase tracking-wider mb-1">현재 플랜</div><div className="text-3xl font-bold capitalize flex items-center gap-3">{sub.status}{sub.status === "cancelled" && <Badge variant="destructive">종료 예정</Badge>}</div><div className="mt-4 text-sm font-medium"><span className="bg-background/20 px-3 py-1.5 rounded-md">심사 사용량: {sub.analysesUsed} / {sub.analysesLimit === -1 ? "무제한" : sub.analysesLimit}</span></div></div>{sub.status !== "free" && sub.status !== "cancelled" && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="bg-transparent border-primary-foreground/20 hover:bg-primary-foreground/10 text-primary-foreground">구독 해지</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>구독을 해지하시겠습니까?</AlertDialogTitle><AlertDialogDescription>청구 주기 종료 시 프리미엄 기능 이용이 불가능해집니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>유지하기</AlertDialogCancel><AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">네, 해지합니다</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</CardContent></Card>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 items-stretch">
        {plans?.map((plan, index) => {
          const isCurrent = sub?.planId === plan.id || (sub?.status === "free" && plan.name.toLowerCase() === "free")
          const isFree = plan.id === "free" || plan.name.toLowerCase() === "free"
          const isPopular = (plan as typeof plan & { popular?: boolean; isPopular?: boolean }).popular === true || (plan as typeof plan & { isPopular?: boolean }).isPopular === true || (!plans.some((p) => (p as typeof p & { popular?: boolean }).popular === true || (p as typeof p & { isPopular?: boolean }).isPopular === true) && index === 1)
          return <Card key={plan.id} className={`relative flex flex-col bg-white dark:bg-slate-50 text-slate-900 rounded-2xl ${isCurrent || isPopular ? "border-blue-600" : "border-slate-200"} ${isCurrent || isPopular ? "ring-1 ring-blue-600" : ""} ${isPopular && !isCurrent ? "shadow-[0_16px_35px_rgba(37,99,235,0.14)]" : ""}`}>
            {isPopular && <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white">가장 인기</div>}
            {isCurrent && <div className="absolute right-5 top-4 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">현재 플랜</div>}
            <CardHeader className="p-8 pb-4"><CardTitle className="text-xl font-bold">{plan.name}</CardTitle><div className={`text-4xl font-extrabold tracking-tight mt-3 ${isPopular && !isCurrent ? "text-blue-600" : "text-slate-900"}`}>₩{plan.price.toLocaleString()}<span className="text-sm font-normal text-slate-400 ml-1">/월</span></div><CardDescription className="text-sm text-slate-500 mt-1">{plan.description}</CardDescription></CardHeader>
            <CardContent className="px-8 flex-1"><ul className="space-y-4 text-sm text-slate-600"><li className="flex items-start gap-2.5"><CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isPopular ? "text-blue-600" : "text-slate-400"}`} /><span>{plan.analysesPerMonth === -1 ? "무제한" : plan.analysesPerMonth}회 AI 서류 심사</span></li>{plan.features?.map((feature, i) => <li key={i} className="flex items-start gap-2.5"><CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isPopular ? "text-blue-600" : "text-slate-400"}`} /><span>{feature}</span></li>)}</ul></CardContent>
            <CardFooter className="p-8 pt-6"><Button className={`w-full h-11 font-bold ${isCurrent ? "border-blue-200 bg-blue-50 text-blue-700" : isPopular ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"}`} variant={isPopular && !isCurrent ? "default" : "outline"} disabled={isCurrent || isFree || subscribe.isPending} onClick={() => handleSubscribe(plan.id)}>{isCurrent ? "현재 이용 중" : isFree ? "기본 제공" : `${plan.name} 시작하기`}</Button></CardFooter>
          </Card>
        })}
      </div>
    </div>
  )
}
