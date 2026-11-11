import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Link, useLocation } from "wouter"
import { useRegister, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BrainCircuit, Building2 } from "lucide-react"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

interface Organization {
  id: number
  name: string
  plan: string
}

const PLAN_LABELS: Record<string, string> = { free: "무료", basic: "베이직", premium: "프리미엄" }
const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  basic: "bg-blue-100 text-blue-700",
  premium: "bg-amber-100 text-amber-700",
}

const registerSchema = z.object({
  name: z.string().min(2, { message: "이름을 입력해주세요" }),
  email: z.string().email({ message: "올바른 이메일을 입력해주세요" }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다" }),
  organizationId: z.string().optional(),
})

export default function RegisterPage() {
  const [, setLocation] = useLocation()
  const { data: user, isSuccess } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } })
  const register = useRegister()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)

  useEffect(() => {
    if (isSuccess && user) setLocation("/dashboard")
  }, [isSuccess, user, setLocation])

  // 활성 기관 목록 불러오기
  useEffect(() => {
    fetch(`${BASE}/api/auth/organizations`)
      .then((r) => r.json())
      .then((data) => setOrgs(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", organizationId: "" },
  })

  function onSubmit(values: z.infer<typeof registerSchema>) {
    const payload: Record<string, string> = {
      name: values.name,
      email: values.email,
      password: values.password,
    }
    if (values.organizationId && values.organizationId !== "none") {
      payload.organizationId = values.organizationId
    }

    register.mutate(
      { data: payload as any },
      {
        onSuccess: () => setLocation("/dashboard"),
        onError: (err) => {
          form.setError("root", { message: (err as any)?.data?.error || "회원가입에 실패했습니다" })
        },
      }
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <BrainCircuit className="w-12 h-12 text-primary" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
          회원가입
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary/90">
            로그인
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {form.formState.errors.root && (
                  <div className="p-3 rounded bg-destructive/10 text-destructive text-sm font-medium">
                    {form.formState.errors.root.message}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>비밀번호</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 소속기관 선택 */}
                <FormField
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        소속기관
                        <span className="text-xs text-muted-foreground font-normal">(선택)</span>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v)
                          const org = orgs.find((o) => String(o.id) === v)
                          setSelectedOrg(org ?? null)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="소속기관을 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">선택 안 함 (무료 플랜)</SelectItem>
                          {orgs.map((org) => (
                            <SelectItem key={org.id} value={String(org.id)}>
                              <span className="flex items-center gap-2">
                                {org.name}
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_COLORS[org.plan] ?? PLAN_COLORS.free}`}
                                >
                                  {PLAN_LABELS[org.plan] ?? org.plan}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 선택한 기관의 플랜 안내 */}
                {selectedOrg && (
                  <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">적용 플랜</span>
                      <Badge className={`text-xs ${PLAN_COLORS[selectedOrg.plan]}`} variant="secondary">
                        {PLAN_LABELS[selectedOrg.plan] ?? selectedOrg.plan}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedOrg.name}에 소속되어 가입하면{" "}
                      <strong>{PLAN_LABELS[selectedOrg.plan] ?? selectedOrg.plan} 등급</strong>으로
                      서비스를 이용할 수 있습니다.
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={register.isPending}>
                  {register.isPending ? "가입 중..." : "회원가입"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
